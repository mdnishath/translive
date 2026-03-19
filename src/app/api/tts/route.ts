// ===========================================
// Text-to-Speech API Route
// Gemini Pro TTS (primary) + Google Wavenet (fallback)
// ===========================================

import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_TTS_CONFIG, GEMINI_TTS_VOICES } from "@/lib/constants";
import type { Language } from "@/types";

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GEMINI_TTS_URL = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";

export async function POST(request: NextRequest) {
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

    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "No TTS service available" },
        { status: 500 }
      );
    }

    // Try Gemini Pro TTS first (natural, expressive voices)
    const geminiVoice = GEMINI_TTS_VOICES[language];
    if (geminiVoice) {
      try {
        const response = await fetch(`${GEMINI_TTS_URL}?key=${GOOGLE_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: {
              text,
              prompt: "Read aloud in a warm, welcoming tone.",
            },
            voice: {
              languageCode: geminiVoice.languageCode,
              name: geminiVoice.voiceName,
              modelName: "gemini-2.5-pro-tts",
            },
            audioConfig: {
              audioEncoding: "LINEAR16",
              speakingRate: 1,
              pitch: 0,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audioContent) {
            return NextResponse.json({
              audioContent: data.audioContent,
              language,
              engine: "gemini-pro-tts",
            });
          }
        } else {
          console.error("[tts] Gemini TTS failed:", response.status);
        }
      } catch (err) {
        console.error("[tts] Gemini TTS error:", err);
      }
    }

    // Fallback: Google Cloud Wavenet TTS
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
          speakingRate: 0.95,
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
      engine: "google-wavenet",
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
