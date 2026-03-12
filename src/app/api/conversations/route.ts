import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: payload.userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, language: true, avatar: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } },
          },
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
