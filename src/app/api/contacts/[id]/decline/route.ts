/**
 * PATCH /api/contacts/[id]/decline
 * Declines an incoming contact request and notifies the sender.
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

    await prisma.contact.update({ where: { id }, data: { status: "DECLINED" } });

    // Notify the sender so they know their request was declined
    const io = getIO();
    if (io) {
      io.to(`user:${contact.userId}`).emit(SOCKET_EVENTS.CONTACT_DECLINED, {
        byUserId: payload.userId,
      });
    }

    return NextResponse.json({ ok: true, requesterId: contact.userId });
  } catch (error) {
    console.error("Decline contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
