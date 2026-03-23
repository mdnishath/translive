import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: payload.userId,
            leftAt: null, // Only conversations the user has NOT left
          },
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, language: true, avatar: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = conversations.map((conv) => {
      const otherParticipant = conv.participants.find((p) => p.userId !== payload.userId);
      const lastMessage = conv.messages[0] ?? null;
      return {
        id: conv.id,
        contact: otherParticipant?.user ?? null,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              translatedContent: lastMessage.translatedContent,
              messageType: lastMessage.messageType,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
            }
          : null,
        updatedAt: conv.updatedAt,
      };
    });

    return NextResponse.json({ conversations: result });
  } catch (error) {
    console.error("Get conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/conversations — Find or create a conversation with another user
export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { participantId } = await request.json();
    if (!participantId) return NextResponse.json({ error: "participantId is required" }, { status: 400 });

    // Check if conversation already exists between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: payload.userId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
    });

    if (existing) {
      // Re-activate participants if they had left
      await prisma.conversationParticipant.updateMany({
        where: { conversationId: existing.id, userId: { in: [payload.userId, participantId] } },
        data: { leftAt: null },
      });
      return NextResponse.json({ id: existing.id, conversationId: existing.id });
    }

    // Create new conversation
    const newConv = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: payload.userId }, { userId: participantId }],
        },
      },
    });

    return NextResponse.json({ id: newConv.id, conversationId: newConv.id }, { status: 201 });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
