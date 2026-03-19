// ===========================================
// Speech-to-Text API Route
// Bengali → Google Cloud STT (accurate)
// French  → Deepgram Nova-3 (fast)
// ===========================================

import { NextRequest, NextResponse } from "next/server";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";
const GOOGLE_STT_URL =
  "https://speech.googleapis.com/v1/speech:recognize";

async function transcribeWithGoogle(
  audioBuffer: ArrayBuffer,
  language: string
): Promise<{ transcript: string; confidence: number }> {
  if (!GOOGLE_API_KEY) throw new Error("Google Cloud API key not configured");

  const base64Audio = Buffer.from(audioBuffer).toString("base64");

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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google STT error:", errorText);
    throw new Error("Google STT failed");
  }

  const data = await response.json();
  const result = data.results?.[0]?.alternatives?.[0];
  return {
    transcript: result?.transcript || "",
    confidence: result?.confidence || 0,
  };
}

async function transcribeWithDeepgram(
  audioBuffer: ArrayBuffer,
  language: string
): Promise<{ transcript: string; confidence: number }> {
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
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Deepgram error:", errorText);
    throw new Error("Deepgram STT failed");
  }

  const data = await response.json();
  return {
    transcript:
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "",
    confidence:
      data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.arrayBuffer();
    const language = request.headers.get("x-language") || "bn";

    // Bengali → Google STT (accurate Bengali support)
    // English/French → Deepgram Nova-3 (fast)
    const { transcript, confidence } =
      language === "bn"
        ? await transcribeWithGoogle(body, language)
        : await transcribeWithDeepgram(body, language);

    return NextResponse.json({ transcript, confidence, language });
  } catch (error) {
    console.error("Transcribe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
