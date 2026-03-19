// ===========================================
// Voice Message Processing Pipeline
// STT → Translate → Voice Clone TTS (server-side)
// ===========================================

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { translateText, getTargetLanguage } from "@/lib/translate";
import { getOrCreateVoiceClone, ttsWithClonedVoice, isVoiceCloningEnabled } from "@/services/voiceClone";
import { readFile } from "fs/promises";
import { join } from "path";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";
const GOOGLE_STT_URL = "https://speech.googleapis.com/v1/speech:recognize";
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GEMINI_TTS_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

const GOOGLE_TTS_CONFIG: Record<string, { languageCode: string; name: string; ssmlGender: string }> = {
  bn: { languageCode: "bn-IN", name: "bn-IN-Chirp3-HD-Despina", ssmlGender: "FEMALE" },
  fr: { languageCode: "fr-FR", name: "fr-FR-Wavenet-A", ssmlGender: "FEMALE" },
  en: { languageCode: "en-US", name: "en-US-Wavenet-F", ssmlGender: "FEMALE" },
};

const GEMINI_TTS_VOICES: Record<string, { languageCode: string; voiceName: string }> = {
  bn: { languageCode: "bn-BD", voiceName: "Despina" },
  fr: { languageCode: "fr-FR", voiceName: "Aoede" },
  en: { languageCode: "en-US", voiceName: "Kore" },
};

// ── STT ──────────────────────────────────────────────────────

async function transcribeWithGoogle(audioBuffer: Buffer, language: string) {
  if (!GOOGLE_API_KEY) throw new Error("Google Cloud API key not configured");
  const base64Audio = audioBuffer.toString("base64");

  const response = await fetch(`${GOOGLE_STT_URL}?key=${GOOGLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: language === "bn" ? "bn-IN" : language === "en" ? "en-US" : "fr-FR",
        enableAutomaticPunctuation: true,
      },
      audio: { content: base64Audio },
    }),
  });

  if (!response.ok) throw new Error("Google STT failed");
  const data = await response.json();
  return data.results?.[0]?.alternatives?.[0]?.transcript || "";
}

async function transcribeWithDeepgram(audioBuffer: Buffer, language: string) {
  if (!DEEPGRAM_API_KEY) throw new Error("Deepgram API key not configured");

  const params = new URLSearchParams({
    model: "nova-3",
    language,
    punctuate: "true",
    smart_format: "true",
  });

  const response = await fetch(`${DEEPGRAM_URL}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/webm",
    },
    body: new Uint8Array(audioBuffer),
  });

  if (!response.ok) throw new Error("Deepgram STT failed");
  const data = await response.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

async function transcribe(audioBuffer: Buffer, language: string): Promise<string> {
  return language === "bn"
    ? transcribeWithGoogle(audioBuffer, language)
    : transcribeWithDeepgram(audioBuffer, language);
}

// ── TTS — Gemini Pro (primary) + Wavenet (fallback) ─────────

async function synthesizeTTS(text: string, language: string): Promise<string | null> {
  if (!GOOGLE_API_KEY || !text.trim()) return null;

  // Try Gemini TTS first (natural voices)
  const geminiVoice = GEMINI_TTS_VOICES[language];
  if (geminiVoice) {
    try {
      const res = await fetch(`${GEMINI_TTS_URL}?key=${GOOGLE_API_KEY}`, {
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
      if (res.ok) {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith("audio/")) {
              return part.inlineData.data;
            }
          }
        }
      }
    } catch (err) {
      console.error("[voice/process] Gemini TTS failed:", err);
    }
  }

  // Fallback: Google Cloud Wavenet
  const voiceConfig = GOOGLE_TTS_CONFIG[language];
  if (!voiceConfig) return null;

  const response = await fetch(`${TTS_URL}?key=${GOOGLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voiceConfig.languageCode, name: voiceConfig.name, ssmlGender: voiceConfig.ssmlGender },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.95, pitch: 0 },
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.audioContent || null;
}

// ── Main route ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { audioUrl, senderLanguage } = await request.json();

    if (!audioUrl || !senderLanguage) {
      return NextResponse.json({ error: "Missing audioUrl or senderLanguage" }, { status: 400 });
    }

    const targetLang = getTargetLanguage(senderLanguage);

    // Read audio file from disk
    const filePath = join(process.cwd(), "public", audioUrl);
    const audioBuffer = await readFile(filePath);

    // Step 1: STT — transcribe the voice message
    const transcript = await transcribe(audioBuffer, senderLanguage);

    if (!transcript) {
      return NextResponse.json({
        transcript: "",
        translatedText: null,
        translatedAudioBase64: null,
      });
    }

    // Step 2: Translate the transcript
    const translation = await translateText(transcript, senderLanguage, targetLang);
    const translatedText = translation?.translatedText || null;

    // Step 3: TTS — try ElevenLabs voice cloning, fallback to Google
    let translatedAudioBase64: string | null = null;
    if (translatedText) {
      // Try voice cloning with ElevenLabs
      if (isVoiceCloningEnabled()) {
        try {
          const voiceId = await getOrCreateVoiceClone(user.userId, audioBuffer);
          if (voiceId) {
            const clonedAudio = await ttsWithClonedVoice(translatedText, targetLang, voiceId);
            if (clonedAudio) {
              translatedAudioBase64 = clonedAudio.toString("base64");
            }
          }
        } catch (err) {
          console.error("[voice/process] ElevenLabs failed, using Google TTS:", err);
        }
      }

      // Fallback to Google TTS
      if (!translatedAudioBase64) {
        translatedAudioBase64 = await synthesizeTTS(translatedText, targetLang);
      }
    }

    return NextResponse.json({
      transcript,
      translatedText,
      translatedAudioBase64,
      targetLanguage: targetLang,
    });
  } catch (error) {
    console.error("[voice/process] Pipeline error:", error);
    return NextResponse.json({ error: "Voice processing failed" }, { status: 500 });
  }
}
