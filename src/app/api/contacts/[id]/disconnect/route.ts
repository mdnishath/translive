/**
 * PATCH /api/contacts/[id]/disconnect
 * Disconnects a contact — deletes ALL contact records between the two users
 * and marks both participants as having left the conversation.
 * Chat history is preserved but hidden from both users' sidebars.
 * Since all contact records are removed, either user can send a fresh request later.
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

    const { id: contactUserId } = await params;

    // Delete ALL contact records between these two users (there may be two from the accept route)
    await prisma.contact.deleteMany({
      where: {
        OR: [
          { userId: payload.userId, contactId: contactUserId },
          { userId: contactUserId, contactId: payload.userId },
        ],
      },
    });

    // Find shared conversation and mark both participants as left
    const conv = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: payload.userId } } },
          { participants: { some: { userId: contactUserId } } },
        ],
      },
    });

    if (conv) {
      await prisma.conversationParticipant.updateMany({
        where: { conversationId: conv.id },
        data: { leftAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Disconnect contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
