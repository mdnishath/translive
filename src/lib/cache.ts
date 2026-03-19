// ===========================================
// In-Memory Translation Cache
// Avoids repeated API calls for the same text
// ===========================================

interface CacheEntry {
  google: string;
  claude: string | null;
  hitCount: number;
  createdAt: number;
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FREQUENT_TTL = 72 * 60 * 60 * 1000; // 72 hours for frequently used
const FREQUENT_THRESHOLD = 3; // hits before considered "frequent"
const MAX_ENTRIES = 5000;

class TranslationCache {
  private cache = new Map<string, CacheEntry>();

  private makeKey(text: string, sourceLang: string, targetLang: string): string {
    return `${text.trim().toLowerCase()}:${sourceLang}:${targetLang}`;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      const ttl = entry.hitCount >= FREQUENT_THRESHOLD ? FREQUENT_TTL : DEFAULT_TTL;
      if (now - entry.createdAt > ttl) {
        this.cache.delete(key);
      }
    }
  }

  get(text: string, sourceLang: string, targetLang: string): CacheEntry | null {
    const key = this.makeKey(text, sourceLang, targetLang);
    const entry = this.cache.get(key);
    if (!entry) return null;

    const ttl = entry.hitCount >= FREQUENT_THRESHOLD ? FREQUENT_TTL : DEFAULT_TTL;
    if (Date.now() - entry.createdAt > ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.hitCount++;
    return entry;
  }

  setGoogle(text: string, sourceLang: string, targetLang: string, translated: string): void {
    if (this.cache.size >= MAX_ENTRIES) this.evictExpired();
    if (this.cache.size >= MAX_ENTRIES) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const key = this.makeKey(text, sourceLang, targetLang);
    const existing = this.cache.get(key);
    this.cache.set(key, {
      google: translated,
      claude: existing?.claude ?? null,
      hitCount: existing?.hitCount ?? 1,
      createdAt: existing?.createdAt ?? Date.now(),
    });
  }

  setClaude(text: string, sourceLang: string, targetLang: string, refined: string): void {
    const key = this.makeKey(text, sourceLang, targetLang);
    const existing = this.cache.get(key);
    if (existing) {
      existing.claude = refined;
    } else {
      this.cache.set(key, {
        google: refined, // fallback
        claude: refined,
        hitCount: 1,
        createdAt: Date.now(),
      });
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

// Singleton — shared across the server process
export const translationCache = new TranslationCache();
