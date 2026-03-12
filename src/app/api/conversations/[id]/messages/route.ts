import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// Fix #15: Cursor-based pagination.
// The client passes ?cursor=<messageId>&limit=<n> to load older messages.
// Without a cursor the most recent PAGE_SIZE messages are returned.
// The response includes { messages, nextCursor } so the client knows whether
// there are more pages to load.
const PAGE_SIZE = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: payload.userId, conversationId } },
    });

    if (!participant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10), 100);

    // Fetch limit+1 rows so we know if there's a next page without an extra query
    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, name: true, language: true } },
      },
      orderBy: { createdAt: "desc" },  // newest-first for efficient cursor slicing
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop(); // remove the sentinel row

    // Return in ascending order so the UI renders oldest → newest
    messages.reverse();

    const nextCursor = hasMore ? messages[0].id : null;

    return NextResponse.json({ messages, nextCursor });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: payload.userId, conversationId } },
    });

    if (!participant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { content, messageType = "TEXT" } = await request.json();
    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const sender = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { language: true },
    });

    const message = await prisma.message.create({
      data: {
        content,
        messageType,
        originalLanguage: sender?.language ?? "bn",
        senderId: payload.userId,
        conversationId,
      },
      include: {
        sender: { select: { id: true, name: true, language: true } },
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
