# Session 11: Voice Message Translation Pipeline

## Status: PENDING
## Prerequisite: Session 10 completed (Voice recording works)

## Goal:
Voice message পাঠালে server-side: STT → Translate → TTS → receiver gets translated audio + text

## Before starting, tell Claude:
> "docs/SESSION_11.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Architecture:
```
Sender records voice (Bengali)
  → Upload to server
  → Deepgram STT: audio → Bengali text
  → Google Translate: Bengali text → French text
  → Google TTS: French text → French audio
  → Save all 4 artifacts (original audio, original text, translated text, translated audio)
  → Send to receiver via Socket.io
```

## Tasks:

### Task 1: Voice Processing Service
`src/services/voiceProcessing.ts` — server-side pipeline:
```typescript
async function processVoiceMessage(audioBuffer: Buffer, sourceLang: Language): Promise<{
  originalText: string;
  translatedText: string;
  translatedAudioUrl: string;
}>
```
- Step 1: Send buffer to Deepgram → get text
- Step 2: Translate text (reuse existing translateText)
- Step 3: Generate TTS audio → save to file
- Return all results

### Task 2: Voice Message API Route
`POST /api/voice/process`:
- Receives uploaded audio file
- Calls voiceProcessing service
- Saves all artifacts to DB (update Message record)
- Returns: originalText, translatedText, translatedAudioUrl

### Task 3: Update Socket Flow
When voice message is sent:
1. Client uploads audio → gets audioUrl
2. Client sends socket event with audioUrl + messageType: "voice"
3. Server triggers async processing
4. Server sends "processing" status to receiver
5. When done, server sends complete message with all translations
6. Receiver gets: original audio + translated audio + both texts

### Task 4: File Storage
`src/lib/storage.ts`:
- Save uploaded voice files to `public/uploads/voice/`
- Save generated TTS files to `public/uploads/tts/`
- Generate unique filenames with timestamps
- File cleanup utility (delete old files)

### Task 5: Error Handling
- If STT fails → send audio without translation, show "Translation unavailable"
- If translation fails → send original text only
- If TTS fails → send translated text without audio
- Retry logic for transient API failures

## Success Criteria:
- [ ] Bengali voice message → French text + French audio generated
- [ ] French voice message → Bengali text + Bengali audio generated
- [ ] Receiver sees processing indicator while translating
- [ ] All 4 artifacts saved in database
- [ ] Graceful degradation when any API fails

## Files to create/modify:
- `src/services/voiceProcessing.ts` (NEW)
- `src/lib/storage.ts` (NEW)
- `src/app/api/voice/process/route.ts` (NEW)
- Update: `src/lib/socket/server.ts`
- Update: `src/app/api/voice/upload/route.ts`

## Next: Session 12
