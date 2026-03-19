// ===========================================
// Smart Translation API Route
// Returns Google translation instantly,
// then Claude refines asynchronously via socket
// ===========================================

import { NextRequest, NextResponse } from "next/server";
import { refineWithClaude } from "@/services/smartTranslation";
import { translationCache } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    const { originalText, googleTranslation, sourceLang, targetLang, contextMessages } =
      await request.json();

    if (!originalText || !googleTranslation || !sourceLang || !targetLang) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = translationCache.get(originalText, sourceLang, targetLang);
    if (cached?.claude) {
      return NextResponse.json({
        refined: cached.claude,
        engine: "claude",
        fromCache: true,
      });
    }

    // Call Claude for refinement
    const refined = await refineWithClaude(
      originalText,
      googleTranslation,
      sourceLang,
      targetLang,
      contextMessages
    );

    return NextResponse.json({
      refined,
      engine: refined ? "claude" : "google",
      fromCache: false,
    });
  } catch (error) {
    console.error("[smart-translate] Error:", error);
    return NextResponse.json(
      { error: "Smart translation failed" },
      { status: 500 }
    );
  }
}
