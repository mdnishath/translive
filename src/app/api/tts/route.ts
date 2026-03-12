// ===========================================
// Text-to-Speech API Route (Google Cloud TTS)
// ===========================================

import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_TTS_CONFIG } from "@/lib/constants";
import type { Language } from "@/types";

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export async function POST(request: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "Google Cloud API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { text, language } = (await request.json()) as {
      text: string;
      language: Language;
    };

    if (!text || !language) {
      return NextResponse.json(
        { error: "Missing required fields: text, language" },
        { status: 400 }
      );
    }

    const voiceConfig = GOOGLE_TTS_CONFIG[language];
    if (!voiceConfig) {
      return NextResponse.json(
        { error: `Unsupported language: ${language}` },
        { status: 400 }
      );
    }

    const response = await fetch(`${TTS_URL}?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 0,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google TTS error:", errorText);
      return NextResponse.json(
        { error: "Text-to-speech failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      audioContent: data.audioContent,
      language,
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
