import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getIO } from "@/lib/socket/io";
import { SOCKET_EVENTS } from "@/lib/socket/events";

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contacts = await prisma.contact.findMany({
      where: { userId: payload.userId, status: "ACCEPTED" },
      include: {
        contact: { select: { id: true, name: true, email: true, language: true, avatar: true } },
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
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true, name: true },
    });
    if (email === currentUser?.email) {
      return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });
    }

    const contactUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, language: true, avatar: true },
    });
    if (!contactUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check for existing request in either direction
    const existing = await prisma.contact.findFirst({
      where: {
        OR: [
          { userId: payload.userId, contactId: contactUser.id },
          { userId: contactUser.id, contactId: payload.userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === "ACCEPTED") {
        return NextResponse.json({ error: "Already connected" }, { status: 400 });
      }
      if (existing.status === "PENDING") {
        return NextResponse.json({ error: "Request already sent" }, { status: 400 });
      }
      // DECLINED — allow re-sending by resetting status
      await prisma.contact.update({
        where: { id: existing.id },
        data: { status: "PENDING" },
      });
    } else {
      await prisma.contact.create({
        data: { userId: payload.userId, contactId: contactUser.id, status: "PENDING" },
      });
    }

    // Notify User B in real time — their requests badge updates instantly
    const io = getIO();
    if (io) {
      io.to(`user:${contactUser.id}`).emit(SOCKET_EVENTS.CONTACT_REQUEST, {
        fromUserId: payload.userId,
        fromUserName: currentUser?.name,
      });
    }

    return NextResponse.json({ contact: contactUser });
  } catch (error) {
    console.error("Add contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
