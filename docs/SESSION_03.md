# Session 03: API Keys Setup + POC Testing

## Status: ✅ DONE
## Prerequisite: Session 01, 02 completed ✅

## Goal:
API keys বসিয়ে POC test করা — মাইকে বাংলা বললে French-এ translate হয়ে শোনা যাবে

## Before starting, tell Claude:
> "docs/SESSION_03.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: API Keys Setup
User-এর `.env.local` ফাইলে keys বসানো হয়েছে কিনা verify করো:
```
DEEPGRAM_API_KEY=xxx
GOOGLE_CLOUD_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
```
- যদি না থাকে, user-কে guide করো কীভাবে পাবে

### Task 2: API Health Check
প্রতিটা API endpoint test করো:
1. `/api/translate` — একটা test translation request পাঠাও (POST with JSON body)
2. `/api/tts` — একটা test TTS request পাঠাও
3. `/api/transcribe` — এটা mic থেকে test হবে browser-এ

### Task 3: Run Dev Server + Browser Test
- `npm run dev` চালাও
- Browser-এ http://localhost:3000 open করো
- Mic button চাপো, বাংলায় বলো, French-এ translate হচ্ছে কিনা দেখো

### Task 4: Bug Fixes
যেকোনো error fix করো:
- CORS issues
- API key errors
- Audio recording issues
- Translation not working

### Task 5: Edge Cases
- Empty audio handling
- Network error handling
- Very long speech handling
- Language switching while recording

## Success Criteria:
- [ ] মাইকে বাংলা বললে screen-এ বাংলা text দেখায়
- [ ] French translation দেখায়
- [ ] French audio বাজে
- [ ] Language switch করে French → Bengali ও কাজ করে
- [ ] History section-এ results থাকে, replay button কাজ করে

## Files that may need changes:
- `src/app/api/transcribe/route.ts`
- `src/app/api/translate/route.ts`
- `src/app/api/tts/route.ts`
- `src/hooks/useTranslationPipeline.ts`
- `.env.local`

## Next: Session 04
