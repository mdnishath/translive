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
          content: `You are a smart translator who makes translations sound natural and human. Refine this machine translation to sound like how a real person would naturally say it — clear, warm, and easy to understand.
${contextBlock}
Original (${sourceName}): ${originalText}
Machine translation (${targetName}): ${googleTranslation}

Rules:
- Make it sound natural and human — not robotic, not like a textbook
- Keep it clear and easy to understand when spoken aloud (this will be read by TTS)
- French: Use "tu/ton/ta" (informal but not slang-heavy). Natural spoken French.
- Bengali: Use "তুমি/তোমার" level — friendly but not overly colloquial. শুদ্ধ কথ্য বাংলা, NOT "তুই/তোর" street-level. Avoid excessive slang.
- English: Natural conversational tone
- Match the emotion of the original message
- Keep the same meaning, don't add or remove information
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
