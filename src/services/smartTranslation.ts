// ===========================================
// Smart Translation Service (Gemini Pro)
// Two-phase: Google Translate (instant) → Gemini Pro (refined)
// ===========================================

import { translationCache } from "@/lib/cache";

// Read API key at call time (not module init) to ensure env vars are loaded
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Simple queue to avoid overwhelming the API
const queue: (() => Promise<void>)[] = [];
let processing = false;
const MAX_CONCURRENT = 3;
let activeCount = 0;

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    const task = queue.shift();
    if (task) {
      activeCount++;
      task().finally(() => {
        activeCount--;
      });
    }
  }
  processing = false;
}

export interface SmartTranslateResult {
  googleTranslation: string;
  geminiTranslation: string | null;
  engine: "google" | "gemini";
  fromCache: boolean;
}

/**
 * Refine a Google translation using Gemini Pro.
 * Returns null if Gemini is unavailable or fails.
 */
export async function refineWithGemini(
  originalText: string,
  googleTranslation: string,
  sourceLang: string,
  targetLang: string,
  contextMessages?: string[]
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    console.error("[smartTranslation] GOOGLE_CLOUD_API_KEY not set!");
    return null;
  }

  // Check cache first
  const cached = translationCache.get(originalText, sourceLang, targetLang);
  if (cached?.claude) return cached.claude;

  const langNames: Record<string, string> = {
    bn: "Bengali",
    fr: "French",
    en: "English",
  };
  const sourceName = langNames[sourceLang] || sourceLang;
  const targetName = langNames[targetLang] || targetLang;

  const contextBlock = contextMessages?.length
    ? `\nRecent conversation context:\n${contextMessages
        .slice(-3)
        .map((m) => `- ${m}`)
        .join("\n")}\n`
    : "";

  console.log(
    `[smartTranslation] Refining with Gemini: "${googleTranslation}" (${sourceLang}→${targetLang})`
  );

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Refine this machine translation. Output ONLY the complete refined translation — nothing else. Do NOT truncate, shorten, or omit any part.
${contextBlock}
Original (${sourceName}): ${originalText}
Machine translation (${targetName}): ${googleTranslation}

CRITICAL RULES:
1. Output the COMPLETE translation — every single sentence must be included
2. Do NOT cut off, shorten, or drop any sentences
3. The refined translation must have the SAME number of sentences as the machine translation
4. Use proper, standard ${targetName}
5. Bengali: শুদ্ধ বাংলা, "তুমি/তোমার" — never "তুই/তোর"
6. Keep it natural and clear for TTS (spoken aloud)
7. Return ONLY the refined translation text — no labels, no explanations`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      console.error("[smartTranslation] Gemini API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const refined = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

    if (!refined) return null;

    // Safety: reject if Gemini truncated the translation (less than 60% of original length)
    if (refined.length < googleTranslation.length * 0.6) {
      console.warn(`[smartTranslation] Gemini truncated! Using Google instead. Gemini: ${refined.length} chars, Google: ${googleTranslation.length} chars`);
      return null;
    }

    if (refined.toLowerCase() === googleTranslation.toLowerCase()) {
      console.log(`[smartTranslation] Gemini agrees with Google — validated`);
    }

    console.log(`[smartTranslation] Refined: "${googleTranslation}" → "${refined}"`);

    // Cache the refined translation
    translationCache.setClaude(originalText, sourceLang, targetLang, refined);

    return refined;
  } catch (error) {
    console.error("[smartTranslation] Gemini API error:", error);
    return null;
  }
}

// Legacy alias for backward compatibility
export const refineWithClaude = refineWithGemini;

/**
 * Queue a Gemini refinement task (non-blocking).
 */
export function queueRefinement(
  originalText: string,
  googleTranslation: string,
  sourceLang: string,
  targetLang: string,
  contextMessages: string[] | undefined,
  onComplete: (refined: string | null) => void
): void {
  queue.push(async () => {
    const result = await refineWithGemini(
      originalText,
      googleTranslation,
      sourceLang,
      targetLang,
      contextMessages
    );
    onComplete(result);
  });
  processQueue();
}
