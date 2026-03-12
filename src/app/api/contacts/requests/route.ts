/**
 * GET /api/contacts/requests
 * Returns incoming PENDING contact requests for the current user.
 * Each item includes the sender's profile so the UI can show name/avatar.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requests = await prisma.contact.findMany({
      where: { contactId: payload.userId, status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, email: true, language: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        from: r.user,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
