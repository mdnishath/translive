import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { translateText, getTargetLanguage } from "@/lib/translate";

/**
 * POST /api/messages/translate-batch
 * Translates old messages that don't have translations yet.
 * Body: { messageIds: string[] }
 * Returns: { translated: { id, translatedContent, translatedLanguage }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageIds } = await request.json();
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: "messageIds required" }, { status: 400 });
    }

    // Limit batch size to prevent abuse
    const ids = messageIds.slice(0, 50);

    // Fetch messages that need translation
    const messages = await prisma.message.findMany({
      where: {
        id: { in: ids },
        translatedContent: null,
        messageType: "TEXT",
      },
      select: {
        id: true,
        content: true,
        originalLanguage: true,
      },
    });

    if (messages.length === 0) {
      return NextResponse.json({ translated: [] });
    }

    // Translate in parallel (bounded concurrency)
    const results = await Promise.allSettled(
      messages.map(async (msg) => {
        const targetLang = getTargetLanguage(msg.originalLanguage);
        const result = await translateText(msg.content, msg.originalLanguage, targetLang);

        if (result) {
          await prisma.message.update({
            where: { id: msg.id },
            data: {
              translatedContent: result.translatedText,
              translatedLanguage: targetLang,
            },
          });
          return {
            id: msg.id,
            translatedContent: result.translatedText,
            translatedLanguage: targetLang,
          };
        }
        return null;
      })
    );

    const translated: { id: string; translatedContent: string; translatedLanguage: string }[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        translated.push(r.value);
      }
    }

    return NextResponse.json({ translated });
  } catch (error) {
    console.error("Batch translate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
