import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getIO } from "@/lib/socket/io";
import { SOCKET_EVENTS } from "@/lib/socket/events";

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

    const currentUser = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
    if (email === currentUser?.email) {
      return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });
    }

    const contactUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, language: true, avatar: true },
    });

    if (!contactUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Add contact record (one direction is enough for lookup; add both for symmetry)
    await prisma.contact.upsert({
      where: { userId_contactId: { userId: payload.userId, contactId: contactUser.id } },
      create: { userId: payload.userId, contactId: contactUser.id },
      update: {},
    });

    // Create a conversation between the two users if one does not already exist
    const existingConv = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: payload.userId } } },
          { participants: { some: { userId: contactUser.id } } },
        ],
      },
    });

    let conversationId: string | null = existingConv?.id ?? null;

    if (!existingConv) {
      const newConv = await prisma.conversation.create({
        data: {
          participants: {
            create: [{ userId: payload.userId }, { userId: contactUser.id }],
          },
        },
      });
      conversationId = newConv.id;
    }

    // Notify both users via Socket.io so their sidebars update immediately —
    // no page refresh needed. Each user's socket auto-joins the new room and
    // calls fetchConversations() on the client side.
    if (conversationId) {
      const io = getIO();
      if (io) {
        const payload_event = { conversationId };
        // Notify the contact (User B) — new conversation appeared for them
        io.to(`user:${contactUser.id}`).emit(SOCKET_EVENTS.NEW_CONVERSATION, payload_event);
        // Also notify User A — their socket joins the room immediately so they
        // can receive messages before they click on the conversation
        io.to(`user:${payload.userId}`).emit(SOCKET_EVENTS.NEW_CONVERSATION, payload_event);
      }
    }

    return NextResponse.json({ contact: contactUser });
  } catch (error) {
    console.error("Add contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
