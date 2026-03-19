/**
 * PATCH /api/conversations/[id]/read
 * Marks the conversation as read for the current user by updating lastReadAt.
 * Returns the updated timestamp so the sender can show read receipts.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;

    const now = new Date();
    await prisma.conversationParticipant.update({
      where: { userId_conversationId: { userId: payload.userId, conversationId } },
      data: { lastReadAt: now },
    });

    return NextResponse.json({ ok: true, lastReadAt: now.toISOString() });
  } catch (error) {
    console.error("Mark as read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
