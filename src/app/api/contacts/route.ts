import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getIO } from "@/lib/socket/io";
import { SOCKET_EVENTS } from "@/lib/socket/events";

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contacts = await prisma.contact.findMany({
      where: { userId: payload.userId, status: "ACCEPTED" },
      include: {
        contact: { select: { id: true, name: true, email: true, language: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contacts: contacts.map((c) => c.contact) });
  } catch (error) {
    console.error("Get contacts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true, name: true },
    });
    if (email === currentUser?.email) {
      return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });
    }

    const contactUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, language: true, avatar: true },
    });
    if (!contactUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check for ALL existing records in either direction (accept route creates two)
    const allExisting = await prisma.contact.findMany({
      where: {
        OR: [
          { userId: payload.userId, contactId: contactUser.id },
          { userId: contactUser.id, contactId: payload.userId },
        ],
      },
    });

    // Check statuses across all records
    const statuses = allExisting.map((r) => r.status);

    if (statuses.includes("BLOCKED")) {
      const blockedRecord = allExisting.find((r) => r.status === "BLOCKED")!;
      if (blockedRecord.userId === payload.userId) {
        return NextResponse.json({ error: "You have blocked this user. Unblock them first to send a request." }, { status: 403 });
      }
      return NextResponse.json({ error: "Unable to send request to this user at this time" }, { status: 403 });
    }

    if (statuses.includes("ACCEPTED")) {
      // Check if EITHER user has left the conversation — if so, re-activate
      const conv = await prisma.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { userId: payload.userId } } },
            { participants: { some: { userId: contactUser.id } } },
          ],
        },
        include: {
          participants: {
            select: { id: true, userId: true, leftAt: true },
          },
        },
      });

      if (conv) {
        const leftParticipants = conv.participants.filter((p) => p.leftAt !== null);
        if (leftParticipants.length > 0) {
          await prisma.conversationParticipant.updateMany({
            where: { id: { in: leftParticipants.map((p) => p.id) } },
            data: { leftAt: null },
          });
          return NextResponse.json({ contact: contactUser, rejoined: true, conversationId: conv.id });
        }
      }

      return NextResponse.json({ error: "Already connected" }, { status: 400 });
    }

    if (statuses.includes("PENDING")) {
      return NextResponse.json({ error: "Request already sent" }, { status: 400 });
    }

    // DECLINED or no records — delete ALL stale records and create fresh with correct direction
    if (allExisting.length > 0) {
      await prisma.contact.deleteMany({
        where: { id: { in: allExisting.map((r) => r.id) } },
      });
    }

    await prisma.contact.create({
      data: { userId: payload.userId, contactId: contactUser.id, status: "PENDING" },
    });

    // Notify User B in real time — their requests badge updates instantly
    const io = getIO();
    if (io) {
      io.to(`user:${contactUser.id}`).emit(SOCKET_EVENTS.CONTACT_REQUEST, {
        fromUserId: payload.userId,
        fromUserName: currentUser?.name,
      });
    }

    return NextResponse.json({ contact: contactUser });
  } catch (error) {
    console.error("Add contact error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
