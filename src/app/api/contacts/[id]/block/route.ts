/**
 * PATCH /api/contacts/[id]/block
 * Blocks a contact — deletes ALL existing contact records between the two users,
 * creates a single BLOCKED record with userId = blocker, and marks both
 * conversation participants as left.
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

    // Delete ALL contact records between these two users (may be two from accept route)
    await prisma.contact.deleteMany({
      where: {
        OR: [
          { userId: payload.userId, contactId: contactUserId },
          { userId: contactUserId, contactId: payload.userId },
        ],
      },
    });

    // Create a single BLOCKED record: userId = blocker
    await prisma.contact.create({
      data: {
        userId: payload.userId,
        contactId: contactUserId,
        status: "BLOCKED",
      },
    });

    // Mark conversation participants as left
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
    console.error("Block contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
