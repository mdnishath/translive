// ===========================================
// Text-to-Speech API Route
// Gemini Pro TTS (primary) + Google Wavenet (fallback)
// ===========================================

import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_TTS_CONFIG, GEMINI_TTS_VOICES } from "@/lib/constants";
import type { Language } from "@/types";

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GEMINI_TTS_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

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
            contents: [
              {
                parts: [
                  { text: `Say the following in a warm, clear, welcoming tone:\n\n${text}` },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: geminiVoice.voiceName,
                  },
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
                  engine: "gemini-tts",
                  mimeType: part.inlineData.mimeType,
                });
              }
            }
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
