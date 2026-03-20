// ===========================================
// Text-to-Speech API Route
// Gemini Pro TTS (expression-aware) + Chirp3-HD fallback
// ===========================================

import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_TTS_CONFIG } from "@/lib/constants";
import type { Language } from "@/types";

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GEMINI_TTS_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-tts:generateContent";

const GEMINI_VOICES: Record<string, string> = {
  bn: "Algenib",
  fr: "Orus",
  en: "Puck",
};

const LANG_NAMES: Record<string, string> = {
  bn: "Bengali",
  fr: "French",
  en: "English",
};

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

    // Try Gemini Pro TTS first (expression-aware)
    const voiceName = GEMINI_VOICES[language];
    const langName = LANG_NAMES[language] || language;
    if (voiceName) {
      try {
        const prompt = text;

        const response = await fetch(`${GEMINI_TTS_URL}?key=${GOOGLE_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const parts = data?.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.mimeType?.startsWith("audio/")) {
                return NextResponse.json({
                  audioContent: part.inlineData.data,
                  language,
                  engine: "gemini-pro-tts",
                  mimeType: part.inlineData.mimeType,
                });
              }
            }
          }
        } else {
          console.error("[tts] Gemini Pro TTS failed:", response.status);
        }
      } catch (err) {
        console.error("[tts] Gemini Pro TTS error:", err);
      }
    }

    // Fallback: Google Cloud TTS (Chirp3-HD)
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
        audioConfig: { audioEncoding: "MP3", speakingRate: 1, pitch: 0 },
      }),
    });

    if (!response.ok) {
      console.error("Google TTS error:", await response.text());
      return NextResponse.json(
        { error: "Text-to-speech failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      audioContent: data.audioContent,
      language,
      engine: "chirp3-hd",
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
