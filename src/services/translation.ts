// ===========================================
// Translation Service — API Client
// ===========================================

import type { Language } from "@/types";

/**
 * Send audio blob to Deepgram for transcription
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language: Language
): Promise<{ transcript: string; confidence: number }> {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "x-language": language },
    body: audioBlob,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Translate text between Bengali and French
 */
export async function translateText(
  text: string,
  sourceLanguage: Language,
  targetLanguage: Language
): Promise<string> {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.translatedText;
}

/**
 * Convert text to speech audio
 */
export async function textToSpeech(
  text: string,
  language: Language
): Promise<{ audioContent: string; mimeType?: string }> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });

  if (!response.ok) {
    throw new Error(`TTS failed: ${response.statusText}`);
  }

  const data = await response.json();
  return { audioContent: data.audioContent, mimeType: data.mimeType };
}
