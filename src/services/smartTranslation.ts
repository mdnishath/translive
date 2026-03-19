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
          content: `You are a real ${targetName}-speaking friend in a casual chat. Rewrite this translation so it sounds exactly like how a real person would say it — natural, warm, friendly, with personality.
${contextBlock}
Original (${sourceName}): ${originalText}
Machine translation (${targetName}): ${googleTranslation}

Rules:
- Sound like a REAL human friend talking — not a translator, not a textbook, not AI
- Use casual everyday language: slang, contractions, filler words when natural
- French: ALWAYS "tu/ton/ta", never "vous". Use spoken French like "t'inquiète", "c'est ouf", "genre", "du coup"
- Bengali: ALWAYS "তুই/তোর" or "তুমি/তোমার", never "আপনি". Use কথ্য বাংলা like "আরে", "যা বাবা", "কি বলিস"
- English: casual like "yeah", "gonna", "dude", "man", "nah", "tbh"
- Match the emotion and energy of the original — if excited, sound excited; if sad, sound sad
- Keep the same meaning but make it feel alive and human
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
