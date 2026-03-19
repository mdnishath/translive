/**
 * PATCH /api/contacts/[id]/unblock
 * Unblocks a previously blocked contact — deletes the BLOCKED record entirely.
 * With no record remaining, either user can send a fresh contact request.
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

    // Delete the BLOCKED record entirely — no stale record remains
    const result = await prisma.contact.deleteMany({
      where: {
        OR: [
          { userId: payload.userId, contactId: contactUserId, status: "BLOCKED" },
          { userId: contactUserId, contactId: payload.userId, status: "BLOCKED" },
        ],
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "No blocked contact found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unblock contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
