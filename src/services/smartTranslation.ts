// ===========================================
// Smart Translation Service (Gemini Pro)
// Two-phase: Google Translate (instant) → Gemini Pro (refined)
// ===========================================

import { translationCache } from "@/lib/cache";

const GEMINI_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;
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
  if (!GEMINI_API_KEY) return null;

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
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a professional translator. Refine this machine translation to be accurate, clear, and natural-sounding in ${targetName}.
${contextBlock}
Original (${sourceName}): ${originalText}
Machine translation (${targetName}): ${googleTranslation}

Rules:
- Produce a clean, professional translation — accurate and easy to understand
- This text will be read aloud by TTS, so it must be clear when spoken
- Use proper, standard ${targetName} — not slang, not overly casual, not street language
- Bengali: Use শুদ্ধ বাংলা (standard Bengali). Use "আপনি/আপনার" or "তুমি/তোমার". NEVER use "তুই/তোর" or regional slang
- French: Use standard French. "tu" is fine but no heavy slang
- English: Use clear, standard English
- Preserve the original meaning exactly — do not add, remove, or exaggerate
- Return ONLY the refined translation, nothing else`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.3,
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
