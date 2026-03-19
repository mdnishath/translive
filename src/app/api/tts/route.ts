// ===========================================
// Text-to-Speech API Route
// Supports: ElevenLabs Voice Clone + Google Cloud TTS fallback
// ===========================================

import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_TTS_CONFIG } from "@/lib/constants";
import { ttsWithClonedVoice, isVoiceCloningEnabled } from "@/services/voiceClone";
import type { Language } from "@/types";

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export async function POST(request: NextRequest) {
  try {
    const { text, language, voiceId } = (await request.json()) as {
      text: string;
      language: Language;
      voiceId?: string; // Optional: ElevenLabs cloned voice ID
    };

    if (!text || !language) {
      return NextResponse.json(
        { error: "Missing required fields: text, language" },
        { status: 400 }
      );
    }

    // Try ElevenLabs cloned voice if voiceId is provided
    if (voiceId && isVoiceCloningEnabled()) {
      try {
        const clonedAudio = await ttsWithClonedVoice(text, language, voiceId);
        if (clonedAudio) {
          return NextResponse.json({
            audioContent: clonedAudio.toString("base64"),
            language,
            engine: "elevenlabs",
          });
        }
      } catch (err) {
        console.error("ElevenLabs TTS failed, falling back to Google:", err);
      }
    }

    // Fallback: Google Cloud TTS
    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "No TTS service available" },
        { status: 500 }
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
          ssmlGender: voiceConfig.ssmlGender,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 0.85,
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
      engine: "google",
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
