// ===========================================
// Server-side translation helper
// Calls Google Cloud Translation API directly
// Used by socket server and API routes
// ===========================================

const TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

export interface TranslateResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

/**
 * Translate text between languages using Google Cloud Translation API.
 * Returns null if translation is not needed (same language) or if it fails.
 */
export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslateResult | null> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    console.error("[translate] Google Cloud API key not configured");
    return null;
  }

  if (sourceLanguage === targetLanguage) return null;
  if (!text.trim()) return null;

  try {
    const response = await fetch(`${TRANSLATE_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: "text",
      }),
    });

    if (!response.ok) {
      console.error("[translate] Google API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const translatedText = data.data?.translations?.[0]?.translatedText || "";

    if (!translatedText) return null;

    return { translatedText, sourceLanguage, targetLanguage };
  } catch (error) {
    console.error("[translate] Error:", error);
    return null;
  }
}

/**
 * Determine the target language for translation.
 * Fallback for 2-language setups — prefer getTargetLanguageFromDb() for 3+ languages.
 */
export function getTargetLanguage(senderLanguage: string): string {
  if (senderLanguage === "bn") return "fr";
  if (senderLanguage === "fr") return "bn";
  return "bn"; // default fallback for English → Bengali
}
