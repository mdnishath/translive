/**
 * GET /api/contacts/blocked
 * Returns all contacts that the current user has blocked.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only return contacts blocked BY the current user (not where they were blocked by someone else)
    const blocked = await prisma.contact.findMany({
      where: { userId: payload.userId, status: "BLOCKED" },
      include: {
        contact: { select: { id: true, name: true, email: true, language: true } },
      },
    });

    const blockedUsers = blocked.map((c) => ({
      id: c.contact.id,
      name: c.contact.name,
      email: c.contact.email,
      language: c.contact.language,
    }));

    return NextResponse.json({ blockedUsers });
  } catch (error) {
    console.error("Get blocked contacts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
