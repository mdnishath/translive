import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contacts = await prisma.contact.findMany({
      where: { userId: payload.userId },
      include: {
        contact: {
          select: { id: true, name: true, email: true, language: true, avatar: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contacts: contacts.map((c) => c.contact) });
  } catch (error) {
    console.error("Get contacts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (email === (await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } }))?.email) {
      return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });
    }

    const contactUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, language: true, avatar: true },
    });

    if (!contactUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Add contact (both directions)
    await prisma.contact.upsert({
      where: { userId_contactId: { userId: payload.userId, contactId: contactUser.id } },
      create: { userId: payload.userId, contactId: contactUser.id },
      update: {},
    });

    // Create a conversation if none exists
    const existingConv = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: { userId: { in: [payload.userId, contactUser.id] } },
        },
        AND: [
          { participants: { some: { userId: payload.userId } } },
          { participants: { some: { userId: contactUser.id } } },
        ],
      },
    });

    if (!existingConv) {
      await prisma.conversation.create({
        data: {
          participants: {
            create: [{ userId: payload.userId }, { userId: contactUser.id }],
          },
        },
      });
    }

    return NextResponse.json({ contact: contactUser });
  } catch (error) {
    console.error("Add contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
