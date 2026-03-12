/**
 * PATCH /api/contacts/[id]/accept
 * Accepts an incoming contact request. Creates the conversation and
 * notifies both users via Socket.io so their sidebars update instantly.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getIO } from "@/lib/socket/io";
import { SOCKET_EVENTS } from "@/lib/socket/events";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact || contact.contactId !== payload.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (contact.status !== "PENDING") {
      return NextResponse.json({ error: "Request already handled" }, { status: 400 });
    }

    // Accept the request
    await prisma.contact.update({ where: { id }, data: { status: "ACCEPTED" } });

    // Also create the reverse contact entry so both users see each other
    await prisma.contact.upsert({
      where: { userId_contactId: { userId: payload.userId, contactId: contact.userId } },
      create: { userId: payload.userId, contactId: contact.userId, status: "ACCEPTED" },
      update: { status: "ACCEPTED" },
    });

    // Create the conversation if it doesn't exist yet
    let conversationId: string;
    const existingConv = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: payload.userId } } },
          { participants: { some: { userId: contact.userId } } },
        ],
      },
    });

    if (existingConv) {
      conversationId = existingConv.id;
      // Re-activate both participants if they had previously left
      await prisma.conversationParticipant.updateMany({
        where: { conversationId, userId: { in: [payload.userId, contact.userId] } },
        data: { leftAt: null },
      });
    } else {
      const newConv = await prisma.conversation.create({
        data: {
          participants: {
            create: [{ userId: payload.userId }, { userId: contact.userId }],
          },
        },
      });
      conversationId = newConv.id;
    }

    // Notify both users via Socket.io
    const io = getIO();
    if (io) {
      const event = { conversationId };
      io.to(`user:${contact.userId}`).emit(SOCKET_EVENTS.CONTACT_ACCEPTED, {
        ...event,
        byUserId: payload.userId,
      });
      // NEW_CONVERSATION triggers auto-join + sidebar refresh on both sides
      io.to(`user:${payload.userId}`).emit(SOCKET_EVENTS.NEW_CONVERSATION, event);
      io.to(`user:${contact.userId}`).emit(SOCKET_EVENTS.NEW_CONVERSATION, event);
    }

    return NextResponse.json({ ok: true, conversationId });
  } catch (error) {
    console.error("Accept contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
