/**
 * DELETE /api/messages/[id]?mode=for_me|for_everyone
 *
 * - for_me: Creates a MessageDeletion record — hides it for this user only.
 * - for_everyone: Sets deletedForEveryone=true (only the sender can do this).
 *   The message content is replaced with a "deleted" placeholder for everyone.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: messageId } = await params;
    const mode = request.nextUrl.searchParams.get("mode") || "for_me";

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Verify the user is a participant of this conversation
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: payload.userId, conversationId: message.conversationId } },
    });
    if (!participant) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (mode === "for_everyone") {
      // Only the sender can delete for everyone
      if (message.senderId !== payload.userId) {
        return NextResponse.json({ error: "Only the sender can delete for everyone" }, { status: 403 });
      }

      await prisma.message.update({
        where: { id: messageId },
        data: { deletedForEveryone: true },
      });

      return NextResponse.json({ ok: true, mode: "for_everyone", conversationId: message.conversationId });
    }

    // mode === "for_me" — create a deletion record
    await prisma.messageDeletion.upsert({
      where: { userId_messageId: { userId: payload.userId, messageId } },
      create: { userId: payload.userId, messageId },
      update: {},
    });

    return NextResponse.json({ ok: true, mode: "for_me" });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
