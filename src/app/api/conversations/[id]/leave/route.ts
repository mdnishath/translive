/**
 * PATCH /api/conversations/[id]/leave
 * Marks the current user as having left the conversation.
 * Sets leftAt timestamp — the conversation is hidden from their sidebar
 * but the other participant's history is preserved.
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

    const { id: conversationId } = await params;

    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: payload.userId, conversationId } },
    });
    if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.conversationParticipant.update({
      where: { userId_conversationId: { userId: payload.userId, conversationId } },
      data: { leftAt: new Date() },
    });

    // Notify others in the room
    const io = getIO();
    if (io) {
      io.to(`conv:${conversationId}`).emit(SOCKET_EVENTS.CONVERSATION_LEFT, {
        userId: payload.userId,
        conversationId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Leave conversation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
