# Session 09: Smart Translation (Claude API + Caching)

## Status: DONE
## Prerequisite: Session 08 completed (Auto-translation working)

## Goal:
Google Translate-এর পর Claude API দিয়ে context-aware refined translation + Redis caching

## Before starting, tell Claude:
> "docs/SESSION_09.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Claude Translation Service
`src/services/smartTranslation.ts`:
- Google Translate-এর result নেবে
- Claude API-তে পাঠাবে context সহ (previous messages for context)
- Claude better translation দিলে update করবে
- Prompt: "You are a Bengali-French translator. Refine this translation considering cultural context and natural expression."

### Task 2: Two-Phase Translation
1. **Instant:** Google Translate → show immediately (fast, ~200ms)
2. **Refined:** Claude API → update if different (~1-2s)
- UI shows small "Refined ✨" badge when Claude version replaces Google version

### Task 3: Translation Cache
Install Redis or use in-memory Map:
- Cache key: `{sourceText}:{sourceLang}:{targetLang}`
- Cache both Google and Claude translations
- TTL: 24 hours
- Frequently used translations persist longer

### Task 4: Translation Quality Indicator
- Show which engine translated (Google / Claude)
- Confidence indicator
- User feedback: thumbs up/down on translations

### Task 5: Rate Limiting
- Claude API rate limit respect
- Queue system for Claude refinements
- Fallback to Google-only if Claude is slow/unavailable

## Success Criteria:
- [x] Messages first show Google translation (instant)
- [x] Claude refined version updates automatically (1-2s later)
- [x] Cached translations load instantly (no API call)
- [x] "Refined" indicator shows on Claude-translated messages
- [x] Works even if Claude API is down (falls back to Google)

## Files to create/modify:
- `src/services/smartTranslation.ts`
- `src/lib/cache.ts` (translation cache)
- `src/app/api/translate/smart/route.ts`
- Update: `src/components/chat/MessageBubble.tsx`
- Update: socket server translation middleware

## Next: Session 10
