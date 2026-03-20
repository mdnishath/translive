// Load env FIRST — before any module-level code uses process.env
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

// Fix #13: Validate required environment variables at bootstrap so the server
// fails loudly with a clear message rather than crashing deep in DB/JWT code.
const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[TransLive] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { setIO } from "./src/lib/socket/io";
import { translateText, getTargetLanguage } from "./src/lib/translate";
import { translationCache } from "./src/lib/cache";
import { refineWithClaude } from "./src/services/smartTranslation";
import { getOrCreateVoiceClone, ttsWithClonedVoice, restoreVoiceCache, isVoiceCloningEnabled } from "./src/services/voiceClone";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

// Fix #12: Restrict CORS origin to the configured app URL instead of "*".
// In development this falls back to localhost:3000.
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Prisma client — DATABASE_URL is now available from dotenv above
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Track online users: userId → Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

// Fix #30: Simple in-process rate limiter for send_message.
// Tracks the timestamp of the last N messages per user using a sliding window.
const MESSAGE_RATE_LIMIT = 10;   // max messages
const MESSAGE_RATE_WINDOW = 5000; // per 5 seconds

/** Returns true if the user has exceeded the rate limit. */
function isRateLimited(userId: string, rateLimitMap: Map<string, number[]>): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  // Drop timestamps outside the window
  const recent = timestamps.filter((t) => now - t < MESSAGE_RATE_WINDOW);
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return recent.length > MESSAGE_RATE_LIMIT;
}

interface AuthSocket extends Socket {
  userId?: string;
  userName?: string;
}

// ── Voice message processing pipeline (STT → Translate → TTS) ──

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";
const GOOGLE_STT_URL = "https://speech.googleapis.com/v1/speech:recognize";
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GEMINI_TTS_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-tts:generateContent";
const GOOGLE_TTS_VOICES: Record<string, { languageCode: string; name: string; ssmlGender: string }> = {
  bn: { languageCode: "bn-IN", name: "bn-IN-Chirp3-HD-Algenib", ssmlGender: "MALE" },
  fr: { languageCode: "fr-FR", name: "fr-FR-Wavenet-A", ssmlGender: "FEMALE" },
  en: { languageCode: "en-US", name: "en-US-Wavenet-F", ssmlGender: "FEMALE" },
};
const GEMINI_TTS_VOICES: Record<string, { voiceName: string }> = {
  bn: { voiceName: "Algenib" },
  fr: { voiceName: "Aoede" },
  en: { voiceName: "Kore" },
};

/** Convert audio to clean OGG/Opus via ffmpeg for reliable STT processing. */
async function normalizeAudio(inputPath: string): Promise<{ buffer: Buffer; format: "OGG_OPUS" | "WEBM_OPUS" }> {
  const outPath = join(tmpdir(), `translive-${Date.now()}.ogg`);
  try {
    await execFileAsync("ffmpeg", [
      "-y", "-i", inputPath,
      "-vn",                    // no video
      "-acodec", "libopus",     // Opus codec
      "-ar", "48000",           // 48kHz
      "-ac", "1",               // mono
      "-b:a", "64k",            // 64kbps
      outPath,
    ], { timeout: 15000 });
    const buffer = await readFile(outPath);
    // Clean up temp file
    try { const { unlink } = await import("fs/promises"); await unlink(outPath); } catch {}
    return { buffer, format: "OGG_OPUS" };
  } catch (err) {
    console.error("[audio] ffmpeg normalization failed, using original:", err);
    const buffer = await readFile(inputPath);
    return { buffer, format: "WEBM_OPUS" };
  }
}

async function sttGoogle(audioBuffer: Buffer, language: string, encoding: string = "WEBM_OPUS"): Promise<string> {
  if (!GOOGLE_API_KEY) { console.error("[stt] No GOOGLE_CLOUD_API_KEY"); return ""; }
  const res = await fetch(`${GOOGLE_STT_URL}?key=${GOOGLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: { encoding, sampleRateHertz: 48000, languageCode: language === "bn" ? "bn-IN" : language === "en" ? "en-US" : "fr-FR", enableAutomaticPunctuation: true },
      audio: { content: audioBuffer.toString("base64") },
    }),
  });
  if (!res.ok) { console.error("[stt] Google STT error:", res.status, await res.text()); return ""; }
  const data = await res.json();
  console.log("[stt] Google STT response:", JSON.stringify(data).slice(0, 300));
  return data.results?.[0]?.alternatives?.[0]?.transcript || "";
}

async function sttDeepgram(audioBuffer: Buffer, language: string): Promise<string> {
  if (!DEEPGRAM_API_KEY) { console.error("[stt] No DEEPGRAM_API_KEY"); return ""; }
  const params = new URLSearchParams({ model: "nova-3", language, punctuate: "true", smart_format: "true" });
  const res = await fetch(`${DEEPGRAM_URL}?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, "Content-Type": "audio/webm" },
    body: new Uint8Array(audioBuffer),
  });
  if (!res.ok) { console.error("[stt] Deepgram error:", res.status, await res.text()); return ""; }
  const data = await res.json();
  console.log("[stt] Deepgram response:", JSON.stringify(data).slice(0, 300));
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

// Convert raw PCM (LINEAR16) to WAV format with proper headers
function pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const wav = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);

  // fmt chunk
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);          // chunk size
  wav.writeUInt16LE(1, 20);           // PCM format
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmData.copy(wav, 44);

  return wav;
}

// Gemini Pro TTS — expressive, emotion-aware voice synthesis
// Gemini analyzes the text mood and adjusts tone automatically:
// sad → sad tone, happy → joyful, excited → energetic, etc.
async function ttsGemini(text: string, language: string): Promise<string | null> {
  if (!GOOGLE_API_KEY || !text.trim()) return null;
  const voice = GEMINI_TTS_VOICES[language];
  if (!voice) return null;

  const langNames: Record<string, string> = { bn: "Bengali", fr: "French", en: "English" };
  const langName = langNames[language] || language;

  // Instruction tells Gemini to detect emotion and adapt expression
  const prompt = `Read the following ${langName} text aloud naturally. Analyze the mood and emotion of the text and adjust your voice accordingly:
- If the text is sad or emotional, speak with a gentle, empathetic tone
- If the text is happy or cheerful, speak with warmth and joy
- If the text is excited or urgent, speak with energy and enthusiasm
- If the text is a question, use natural questioning intonation
- If the text is casual/friendly, speak in a relaxed, conversational way
- Match the emotion naturally — do not exaggerate

Text to speak: ${text}`;

  try {
    const res = await fetch(`${GEMINI_TTS_URL}?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice.voiceName,
              },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[tts] Gemini Pro TTS failed:", res.status, errText);
      return null;
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("audio/")) {
          console.log("[tts] ✓ Gemini Pro TTS success, voice:", voice.voiceName);
          return part.inlineData.data;
        }
      }
    }

    console.error("[tts] Gemini Pro TTS: no audio in response, finishReason:", data?.candidates?.[0]?.finishReason);
    return null;
  } catch (err) {
    console.error("[tts] Gemini Pro TTS error:", err);
    return null;
  }
}

// Google Cloud Wavenet TTS — fallback
async function ttsGoogle(text: string, language: string): Promise<string | null> {
  if (!GOOGLE_API_KEY || !text.trim()) return null;
  const voice = GOOGLE_TTS_VOICES[language];
  if (!voice) return null;
  const res = await fetch(`${TTS_URL}?key=${GOOGLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voice.languageCode, name: voice.name, ssmlGender: voice.ssmlGender },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.95, pitch: 0 },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.audioContent || null;
}

async function processVoiceMessage(
  messageId: string,
  audioUrl: string,
  senderLang: string,
  targetLang: string,
  conversationId: string,
  io: Server,
  senderId: string,
  senderName?: string,
) {
  console.log(`[voice] Processing ${messageId}: STT → Translate → Voice Clone TTS`);

  // Step 1: Normalize audio via ffmpeg (fixes corrupted WebM from Android)
  const filePath = join(process.cwd(), "public", audioUrl);
  const originalBuffer = await readFile(filePath);
  const { buffer: audioBuffer, format: audioFormat } = await normalizeAudio(filePath);
  console.log(`[voice] Audio normalized: format=${audioFormat}, size=${audioBuffer.length}`);

  // Step 2: STT — Bengali uses Google, English/French use Deepgram
  console.log(`[voice] STT: senderLang=${senderLang}, targetLang=${targetLang}, using ${senderLang === "bn" ? "Google" : "Deepgram"}`);
  let transcript = "";
  if (senderLang === "bn") {
    transcript = await sttGoogle(audioBuffer, senderLang, audioFormat);
  } else {
    // Try Deepgram first, fallback to Google if empty or error
    try {
      transcript = await sttDeepgram(audioBuffer, senderLang);
    } catch (err) {
      console.error(`[voice] Deepgram error, falling back to Google STT:`, err);
    }
    if (!transcript) {
      console.log(`[voice] Deepgram failed, trying Google STT fallback`);
      transcript = await sttGoogle(audioBuffer, senderLang, audioFormat);
    }
  }

  if (!transcript) {
    console.log(`[voice] No transcript for ${messageId} (lang: ${senderLang})`);
    // Emit voice_processed with empty transcript so UI stops showing "Transcribing..."
    io.to(`conv:${conversationId}`).emit("voice_processed", {
      messageId,
      conversationId,
      transcript: "",
      translatedText: null,
      translatedAudioUrl: null,
      engine: null,
    });
    return;
  }

  console.log(`[voice] Transcript: "${transcript}"`);

  // Step 3: Translate (Google first)
  const translation = await translateText(transcript, senderLang, targetLang);
  let translatedText = translation?.translatedText || null;
  let translationEngine: "google" | "gemini" = "google";
  console.log(`[voice] Google translation: "${translatedText}"`);

  // Step 4: Refine with Gemini Pro (wait up to 10s)
  if (translatedText) {
    try {
      const recentMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { content: true },
      });
      const contextMessages = recentMessages.reverse().map((m) => m.content);

      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
      const refined = await Promise.race([
        refineWithClaude(transcript, translatedText, senderLang, targetLang, contextMessages),
        timeout,
      ]);

      if (refined) {
        translatedText = refined;
        translationEngine = "gemini";
        console.log(`[voice] Gemini refined: "${refined}"`);
      }
    } catch (err) {
      console.error("[voice] Gemini refinement error:", err);
    }
  }

  // Step 5: Voice Clone TTS — use sender's voice via ElevenLabs, fallback to Google
  let translatedAudioUrl: string | null = null;
  if (translatedText) {
    let audioData: Buffer | null = null;

    // Voice cloning disabled — Google Wavenet female voices are clearer
    // and more professional than cloned voices for translation.
    // To re-enable: uncomment the ElevenLabs block below.
    //
    // if (isVoiceCloningEnabled()) {
    //   try {
    //     const voiceId = await getOrCreateVoiceClone(senderId, originalBuffer, senderName);
    //     if (voiceId) {
    //       audioData = await ttsWithClonedVoice(translatedText, targetLang, voiceId);
    //     }
    //   } catch (err) {
    //     console.error("[voice] ElevenLabs failed:", err);
    //   }
    // }

    // Gemini Pro TTS for all languages (expression-aware)
    // Fallback: Chirp3-HD (Google Cloud TTS)
    let ttsSource: "gemini" | "google" | null = null;
    {
      console.log("[voice] Trying Gemini Pro TTS (expression-aware)...");
      let audioBase64 = await ttsGemini(translatedText, targetLang);
      if (audioBase64) {
        ttsSource = "gemini";
      } else {
        console.log("[voice] Gemini TTS failed, falling back to Chirp3-HD...");
        audioBase64 = await ttsGoogle(translatedText, targetLang);
        if (audioBase64) ttsSource = "google";
      }

      if (audioBase64) {
        audioData = Buffer.from(audioBase64, "base64");
        console.log("[voice] ✓ TTS success via", ttsSource);
      }
    }

    // Save the audio file
    if (audioData) {
      const ttsDir = join(process.cwd(), "public", "uploads", "voice-tts");
      await mkdir(ttsDir, { recursive: true });

      // Gemini returns raw PCM (LINEAR16, 24kHz, mono) — wrap in WAV header
      if (ttsSource === "gemini") {
        audioData = pcmToWav(audioData, 24000, 1, 16);
      }

      const ext = ttsSource === "gemini" ? "wav" : "mp3";
      const ttsFilename = `${messageId}.${ext}`;
      await writeFile(join(ttsDir, ttsFilename), audioData);
      translatedAudioUrl = `/uploads/voice-tts/${ttsFilename}`;
    }
  }

  // Step 6: Update DB with refined translation
  await prisma.message.update({
    where: { id: messageId },
    data: {
      content: transcript,
      translatedContent: translatedText,
      translatedLanguage: translatedText ? targetLang : null,
      translatedAudioUrl,
      translationEngine,
    },
  });

  // Step 7: Emit to all participants
  io.to(`conv:${conversationId}`).emit("voice_processed", {
    messageId,
    conversationId,
    transcript,
    translatedText,
    translatedAudioUrl,
    engine: translationEngine,
  });

  console.log(`[voice] Done processing ${messageId} (engine: ${translationEngine})`);
}

async function bootstrap() {
  await app.prepare();

  // Restore voice clone cache from DB for users who already have cloned voices
  const usersWithClones = await prisma.user.findMany({
    where: { voiceCloneId: { not: null } },
    select: { id: true, voiceCloneId: true },
  });
  for (const user of usersWithClones) {
    if (user.voiceCloneId) restoreVoiceCache(user.id, user.voiceCloneId);
  }
  if (usersWithClones.length > 0) {
    console.log(`[voice-clone] Restored ${usersWithClones.length} cached voice clone(s)`);
  }

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Fix #12: Explicit allowed origin instead of wildcard
  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  // Make io accessible to Next.js API routes (same Node.js process)
  setIO(io);

  // Per-user rate limit state (lives as long as the server process)
  const sendRateLimitMap = new Map<string, number[]>();

  // ─── Socket.io auth middleware ────────────────────────────────
  io.use((socket: AuthSocket, next) => {
    // auth_token is HttpOnly — JS can't read it, but polling transport
    // sends it automatically in HTTP Cookie headers on the server side.
    const cookieHeader = socket.handshake.headers?.cookie ?? "";
    const cookieToken = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("auth_token="))
      ?.slice("auth_token=".length);

    const token = cookieToken ? decodeURIComponent(cookieToken) : null;

    if (!token) return next(new Error("Unauthorized"));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
      (socket as AuthSocket).userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // ─── Socket.io event handlers ─────────────────────────────────
  io.on("connection", async (socket: AuthSocket) => {
    const userId = socket.userId!;
    console.log(`[socket] Connected: userId=${userId} socketId=${socket.id}`);

    // Track online
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);

    // Personal room — used by API routes to push events to a specific user
    // (e.g. "a new conversation was created for you") without knowing their socket ID.
    socket.join(`user:${userId}`);

    // Join all conversation rooms this user participates in
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    for (const p of participations) {
      socket.join(`conv:${p.conversationId}`);
    }

    // Fetch user name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    (socket as AuthSocket).userName = user?.name;

    // Notify others this user is online
    socket.broadcast.emit("user_online", { userId });

    // Send current online list to this client
    socket.emit("online_users", Array.from(onlineUsers.keys()));

    // ── join_conversation ────────────────────────────────────────
    socket.on("join_conversation", (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
    });

    // ── send_message ─────────────────────────────────────────────
    socket.on("send_message", async (data: { conversationId: string; content: string; tempId: string }) => {
      // Fix #30: Reject messages that exceed the per-user rate limit
      if (isRateLimited(userId, sendRateLimitMap)) {
        socket.emit("message_error", {
          tempId: data.tempId,
          error: "You are sending messages too fast. Please slow down.",
        });
        return;
      }

      try {
        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { language: true },
        });

        const senderLang = sender?.language ?? "bn";

        // Look up the other participant's language from the conversation
        const otherParticipant = await prisma.conversationParticipant.findFirst({
          where: { conversationId: data.conversationId, userId: { not: userId } },
          include: { user: { select: { language: true } } },
        });
        const targetLang = otherParticipant?.user?.language ?? getTargetLanguage(senderLang);

        // ── Translation: cache → Google → Gemini (wait with timeout) ──
        const cached = translationCache.get(data.content, senderLang, targetLang);
        let finalTranslation: string | null = null;
        let translationEngine: "google" | "gemini" | null = null;

        if (cached) {
          finalTranslation = cached.claude ?? cached.google;
          translationEngine = cached.claude ? "gemini" : "google";
        } else {
          // Step 1: Google Translate (instant)
          const translation = await translateText(data.content, senderLang, targetLang);
          const googleText = translation?.translatedText ?? null;
          if (googleText) {
            translationCache.setGoogle(data.content, senderLang, targetLang, googleText);

            // Step 2: Wait for Gemini refinement (max 10s timeout)
            const recentMessages = await prisma.message.findMany({
              where: { conversationId: data.conversationId },
              orderBy: { createdAt: "desc" },
              take: 5,
              select: { content: true },
            });
            const contextMessages = recentMessages.reverse().map((m) => m.content);

            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
            const refined = await Promise.race([
              refineWithClaude(data.content, googleText, senderLang, targetLang, contextMessages),
              timeout,
            ]);

            finalTranslation = refined ?? googleText;
            translationEngine = refined ? "gemini" : "google";
          }
        }

        const message = await prisma.message.create({
          data: {
            content: data.content,
            translatedContent: finalTranslation,
            translationEngine: translationEngine,
            messageType: "TEXT",
            originalLanguage: senderLang,
            translatedLanguage: finalTranslation ? targetLang : null,
            senderId: userId,
            conversationId: data.conversationId,
          },
          include: {
            sender: { select: { id: true, name: true, language: true } },
          },
        });

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { updatedAt: new Date() },
        });

        // Emit once with best available translation — no flicker
        socket.emit("message_saved", { tempId: data.tempId, message, engine: translationEngine });
        socket.to(`conv:${data.conversationId}`).emit("receive_message", { message, engine: translationEngine });
      } catch (err) {
        console.error("send_message error:", err);
        socket.emit("message_error", { tempId: data.tempId, error: "Failed to send" });
      }
    });

    // ── send_voice_message ──────────────────────────────────────
    socket.on("send_voice_message", async (data: { conversationId: string; audioUrl: string; tempId: string }) => {
      if (isRateLimited(userId, sendRateLimitMap)) {
        socket.emit("message_error", {
          tempId: data.tempId,
          error: "You are sending messages too fast. Please slow down.",
        });
        return;
      }

      try {
        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { language: true },
        });

        const senderLang = sender?.language ?? "bn";

        // Look up the other participant's language from the conversation
        const otherParticipant = await prisma.conversationParticipant.findFirst({
          where: { conversationId: data.conversationId, userId: { not: userId } },
          include: { user: { select: { language: true } } },
        });
        const targetLang = otherParticipant?.user?.language ?? getTargetLanguage(senderLang);

        const message = await prisma.message.create({
          data: {
            content: "",
            messageType: "VOICE",
            originalLanguage: senderLang,
            audioUrl: data.audioUrl,
            senderId: userId,
            conversationId: data.conversationId,
          },
          include: {
            sender: { select: { id: true, name: true, language: true } },
          },
        });

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { updatedAt: new Date() },
        });

        // Emit immediately — voice message appears in chat
        socket.emit("message_saved", { tempId: data.tempId, message });
        socket.to(`conv:${data.conversationId}`).emit("receive_message", { message });

        // ── Async pipeline: STT → Translate → TTS ──────────────
        // Runs in background — emits voice_processed when done
        processVoiceMessage(message.id, data.audioUrl, senderLang, targetLang, data.conversationId, io, userId, socket.userName)
          .catch((err) => console.error("[voice] Pipeline error for", message.id, err));
      } catch (err) {
        console.error("send_voice_message error:", err);
        socket.emit("message_error", { tempId: data.tempId, error: "Failed to send voice message" });
      }
    });

    // ── contact notification relays ──────────────────────────────
    // The client emits these AFTER the REST API call succeeds.
    // The server relays to the target user's personal room.
    // This is the reliable path — getIO() in Next.js API routes may
    // return null when the route runs in a different module context.

    socket.on("notify_contact_request", (data: { targetUserId: string }) => {
      console.log(`[socket] notify_contact_request: from=${userId} to=${data.targetUserId}`);
      const room = `user:${data.targetUserId}`;
      const sockets = io.sockets.adapter.rooms.get(room);
      console.log(`[socket] Room ${room} has ${sockets?.size ?? 0} socket(s)`);
      io.to(room).emit("contact_request", {
        fromUserId: userId,
        fromUserName: socket.userName,
      });
    });

    socket.on("notify_contact_accepted", (data: { targetUserId: string; conversationId: string }) => {
      console.log(`[socket] notify_contact_accepted: from=${userId} to=${data.targetUserId} conv=${data.conversationId}`);
      // Notify the original requester that their request was accepted
      io.to(`user:${data.targetUserId}`).emit("contact_accepted", {
        byUserId: userId,
        byUserName: socket.userName,
        conversationId: data.conversationId,
      });
      // Both users need to know about the new conversation
      io.to(`user:${data.targetUserId}`).emit("new_conversation", {
        conversationId: data.conversationId,
      });
      // Also notify the acceptor (current user) so their sidebar updates
      socket.emit("new_conversation", { conversationId: data.conversationId });
    });

    socket.on("notify_contact_declined", (data: { targetUserId: string }) => {
      io.to(`user:${data.targetUserId}`).emit("contact_declined", {
        byUserId: userId,
        byUserName: socket.userName,
      });
    });

    socket.on("notify_conversation_rejoined", (data: { targetUserId: string; conversationId: string }) => {
      console.log(`[socket] notify_conversation_rejoined: from=${userId} to=${data.targetUserId} conv=${data.conversationId}`);
      // Notify the other user so their sidebar refreshes with the reactivated conversation
      io.to(`user:${data.targetUserId}`).emit("new_conversation", {
        conversationId: data.conversationId,
      });
      // Also let the current user join the conversation room
      socket.join(`conv:${data.conversationId}`);
    });

    // ── block / disconnect relay ─────────────────────────────────────
    socket.on("notify_contact_blocked", (data: { targetUserId: string; conversationId?: string }) => {
      console.log(`[socket] notify_contact_blocked: from=${userId} to=${data.targetUserId}`);
      io.to(`user:${data.targetUserId}`).emit("contact_blocked", {
        byUserId: userId,
        conversationId: data.conversationId,
      });
    });

    socket.on("notify_contact_disconnected", (data: { targetUserId: string; conversationId?: string }) => {
      console.log(`[socket] notify_contact_disconnected: from=${userId} to=${data.targetUserId}`);
      io.to(`user:${data.targetUserId}`).emit("contact_disconnected", {
        byUserId: userId,
        conversationId: data.conversationId,
      });
    });

    // ── message deletion relay ─────────────────────────────────────
    socket.on("notify_message_deleted", (data: { conversationId: string; messageId: string }) => {
      // Relay to all participants in the conversation room (including sender for multi-device)
      io.to(`conv:${data.conversationId}`).emit("message_deleted", {
        messageId: data.messageId,
        conversationId: data.conversationId,
      });
    });

    // ── read receipts relay ────────────────────────────────────────
    socket.on("notify_messages_read", (data: { conversationId: string; readAt: string }) => {
      // Notify OTHER participants (not the reader) so they can update checkmarks
      socket.to(`conv:${data.conversationId}`).emit("messages_read", {
        conversationId: data.conversationId,
        userId,
        readAt: data.readAt,
      });
    });

    // ── language change relay ─────────────────────────────────────
    socket.on("notify_language_changed", async (data: { language: string }) => {
      console.log(`[socket] notify_language_changed: userId=${userId} language=${data.language}`);
      // Broadcast to all conversations this user participates in
      const parts = await prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      for (const p of parts) {
        socket.to(`conv:${p.conversationId}`).emit("language_changed", {
          userId,
          language: data.language,
        });
      }
    });

    // ── typing ────────────────────────────────────────────────────
    socket.on("typing_start", (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit("user_typing", {
        userId,
        name: socket.userName,
        conversationId,
      });
    });

    socket.on("typing_stop", (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit("user_stop_typing", { userId, conversationId });
    });

    // ── disconnect ────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit("user_offline", { userId });
        }
      }
    });
  });

  const PORT = parseInt(process.env.PORT ?? "3000", 10);
  httpServer.listen(PORT, () => {
    console.log(`> TransLive ready on http://localhost:${PORT}`);
    console.log(`> CORS allowed origin: ${ALLOWED_ORIGIN}`);
  });
}

bootstrap().catch(console.error);
