/**
 * DELETE /api/conversations/[id]/clear
 * Clears chat history for the CURRENT USER only. Creates MessageDeletion
 * records so messages are hidden for this user but still visible to the
 * other participant.
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

    const { id: conversationId } = await params;

    // Verify the user is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: payload.userId, conversationId } },
    });
    if (!participant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get all message IDs in this conversation that don't already have a
    // deletion record for this user
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        deletions: { none: { userId: payload.userId } },
      },
      select: { id: true },
    });

    if (messages.length > 0) {
      // Batch create MessageDeletion records
      await prisma.messageDeletion.createMany({
        data: messages.map((m) => ({
          userId: payload.userId,
          messageId: m.id,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ ok: true, clearedCount: messages.length });
  } catch (error) {
    console.error("Clear chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
