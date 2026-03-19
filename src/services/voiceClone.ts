// ===========================================
// ElevenLabs Voice Cloning Service
// Instant Voice Cloning + TTS with cloned voice
// ===========================================

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const MULTILINGUAL_MODEL = "eleven_multilingual_v2";

// In-memory cache: userId → voiceId (persists across requests while server runs)
const voiceCache = new Map<string, { voiceId: string; createdAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient | null {
  // Read env lazily — dotenv may not have loaded when this module was first imported
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey === "your-elevenlabs-api-key-here") {
    return null;
  }
  if (!client) {
    client = new ElevenLabsClient({ apiKey });
  }
  return client;
}

// ── Language code mapping for ElevenLabs ──

// Only languages supported by eleven_multilingual_v2 for explicit languageCode
// Bengali is NOT supported — model will auto-detect from text content
const LANGUAGE_CODES: Record<string, string> = {
  fr: "fr",  // French
  en: "en",  // English
};

// ── Get or create a voice clone for a user ──

export async function getOrCreateVoiceClone(
  userId: string,
  audioBuffer: Buffer,
  userName?: string,
): Promise<string | null> {
  const elevenlabs = getClient();
  if (!elevenlabs) {
    console.log("[voice-clone] ElevenLabs not configured, skipping");
    return null;
  }

  // Check cache first
  const cached = voiceCache.get(userId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    console.log(`[voice-clone] Using cached voice ${cached.voiceId} for user ${userId}`);
    return cached.voiceId;
  }

  // If cached voice exists but expired, delete old one
  if (cached) {
    await deleteVoiceClone(cached.voiceId);
    voiceCache.delete(userId);
  }

  try {
    // Estimate audio duration from buffer size
    // WebM/Opus at ~32kbps ≈ 4000 bytes/sec; require ~5s for noise removal
    const estimatedDurationSec = audioBuffer.length / 4000;
    const useNoiseRemoval = estimatedDurationSec >= 5;
    console.log(`[voice-clone] Creating voice clone for user ${userId} (~${estimatedDurationSec.toFixed(1)}s, noise removal: ${useNoiseRemoval})`);

    // Convert buffer to a File-like object for the SDK
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/webm" });
    const audioFile = new File([audioBlob], "voice-sample.webm", { type: "audio/webm" });

    const voice = await elevenlabs.voices.ivc.create({
      name: `TransLive-${userName || userId}`,
      files: [audioFile],
      removeBackgroundNoise: useNoiseRemoval,
    });

    const voiceId = voice.voiceId;
    console.log(`[voice-clone] Created voice clone: ${voiceId}`);

    // Cache the voice ID
    voiceCache.set(userId, { voiceId, createdAt: Date.now() });

    return voiceId;
  } catch (error) {
    console.error("[voice-clone] Failed to create voice clone:", error);
    return null;
  }
}

// ── Generate TTS with a cloned voice ──

export async function ttsWithClonedVoice(
  text: string,
  language: string,
  voiceId: string,
): Promise<Buffer | null> {
  const elevenlabs = getClient();
  if (!elevenlabs || !text.trim()) return null;

  try {
    console.log(`[voice-clone] Generating TTS with voice ${voiceId} in ${language}`);

    // eleven_multilingual_v2 auto-detects language from text
    // Only pass languageCode for supported languages (not Bengali)
    const langCode = LANGUAGE_CODES[language];
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      modelId: MULTILINGUAL_MODEL,
      ...(langCode ? { languageCode: langCode } : {}),
      outputFormat: "mp3_44100_128",
    });

    // Collect the response into a buffer
    const chunks: Uint8Array[] = [];
    const reader = audioStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const audioBuffer = Buffer.concat(chunks);
    console.log(`[voice-clone] Generated ${audioBuffer.length} bytes of cloned audio`);

    return audioBuffer;
  } catch (error) {
    console.error("[voice-clone] TTS with cloned voice failed:", error);
    return null;
  }
}

// ── Delete a voice clone ──

export async function deleteVoiceClone(voiceId: string): Promise<void> {
  const elevenlabs = getClient();
  if (!elevenlabs) return;

  try {
    await elevenlabs.voices.delete(voiceId);
    console.log(`[voice-clone] Deleted voice clone: ${voiceId}`);
  } catch (error) {
    console.error(`[voice-clone] Failed to delete voice ${voiceId}:`, error);
  }
}

// ── Get cached voice ID for a user (used by DB sync) ──

export function getCachedVoiceId(userId: string): string | null {
  const cached = voiceCache.get(userId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.voiceId;
  }
  return null;
}

// ── Restore cache from DB (call on server startup) ──

export function restoreVoiceCache(userId: string, voiceId: string): void {
  voiceCache.set(userId, { voiceId, createdAt: Date.now() });
}

// ── Check if ElevenLabs is configured ──

export function isVoiceCloningEnabled(): boolean {
  return getClient() !== null;
}

// ── Future: Streaming TTS for real-time calling ──
// ElevenLabs supports WebSocket streaming TTS at:
//   wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input
//
// For real-time calling, the flow will be:
//   1. Open WebSocket connection with cloned voice ID
//   2. Stream translated text chunks as they arrive from STT
//   3. Receive audio chunks back in real-time
//   4. Pipe audio chunks to WebRTC peer connection
//
// This enables sub-second latency voice-cloned translation during calls.
// Implementation will be added when WebRTC calling is built.
