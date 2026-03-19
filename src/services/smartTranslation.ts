// ===========================================
// Smart Translation Service (Claude API)
// Two-phase: Google (instant) → Claude (refined)
// ===========================================

import Anthropic from "@anthropic-ai/sdk";
import { translationCache } from "@/lib/cache";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

// Simple queue to avoid overwhelming the Claude API
const queue: (() => Promise<void>)[] = [];
let processing = false;
const MAX_CONCURRENT = 2;
let activeCount = 0;

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    const task = queue.shift();
    if (task) {
      activeCount++;
      task().finally(() => { activeCount--; });
    }
  }
  processing = false;
}

export interface SmartTranslateResult {
  googleTranslation: string;
  claudeTranslation: string | null;
  engine: "google" | "claude";
  fromCache: boolean;
}

/**
 * Refine a Google translation using Claude API.
 * Returns null if Claude is unavailable or the translation is the same.
 */
export async function refineWithClaude(
  originalText: string,
  googleTranslation: string,
  sourceLang: string,
  targetLang: string,
  contextMessages?: string[]
): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  // Check cache first
  const cached = translationCache.get(originalText, sourceLang, targetLang);
  if (cached?.claude) return cached.claude;

  const langNames: Record<string, string> = { bn: "Bengali", fr: "French", en: "English" };
  const sourceName = langNames[sourceLang] || sourceLang;
  const targetName = langNames[targetLang] || targetLang;

  const contextBlock = contextMessages?.length
    ? `\nRecent conversation context:\n${contextMessages.slice(-3).map((m) => `- ${m}`).join("\n")}\n`
    : "";

  console.log(`[smartTranslation] Refining: "${googleTranslation}" (${sourceLang}→${targetLang})`);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are a professional translator. Refine this machine translation to be accurate, clear, and natural-sounding in ${targetName}.
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
    });

    const refined =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : null;

    if (!refined) return null;

    // If Claude agrees with Google, still return it (marks engine as "claude")
    if (refined.toLowerCase() === googleTranslation.toLowerCase()) {
      console.log(`[smartTranslation] Claude agrees with Google — validated`);
    }

    console.log(`[smartTranslation] Refined: "${googleTranslation}" → "${refined}"`);


    // Cache the refined translation
    translationCache.setClaude(originalText, sourceLang, targetLang, refined);

    return refined;
  } catch (error) {
    console.error("[smartTranslation] Claude API error:", error);
    return null;
  }
}

/**
 * Queue a Claude refinement task (non-blocking).
 * Calls the callback when done.
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
    const result = await refineWithClaude(
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
