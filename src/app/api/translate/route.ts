// ===========================================
// Translation API Route (Google Cloud Translation)
// ===========================================

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const TRANSLATE_URL =
  "https://translation.googleapis.com/language/translate/v2";

export async function POST(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "Google Cloud API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { text, sourceLanguage, targetLanguage } = await request.json();

    if (!text || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: "Missing required fields: text, sourceLanguage, targetLanguage" },
        { status: 400 }
      );
    }

    const response = await fetch(`${TRANSLATE_URL}?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: "text",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Translate error:", errorText);
      return NextResponse.json(
        { error: "Translation failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const translatedText =
      data.data?.translations?.[0]?.translatedText || "";

    return NextResponse.json({
      translatedText,
      sourceLanguage,
      targetLanguage,
    });
  } catch (error) {
    console.error("Translate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
