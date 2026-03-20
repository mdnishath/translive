// ===========================================
// Smart Translation API Route
// Google Translate (instant) → Gemini Pro (refined)
// ===========================================

import { NextRequest, NextResponse } from "next/server";
import { refineWithGemini } from "@/services/smartTranslation";
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
        engine: "gemini",
        fromCache: true,
      });
    }

    // Call Gemini for refinement
    const refined = await refineWithGemini(
      originalText,
      googleTranslation,
      sourceLang,
      targetLang,
      contextMessages
    );

    return NextResponse.json({
      refined,
      engine: refined ? "gemini" : "google",
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
