# Session 17: Call Quality Optimization

## Status: PENDING
## Prerequisite: Session 16 completed (Subtitles working)

## Goal:
Translation latency কমানো, VAD, sentence boundary detection, fallback mechanisms

## Before starting, tell Claude:
> "docs/SESSION_17.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Problem Context:
Real-time call translation-এ latency সবচেয়ে বড় সমস্যা।
Target: speaker থামার পর 3 সেকেন্ডের মধ্যে translated audio শুরু হওয়া।

Current pipeline latency:
- Deepgram STT streaming: ~300ms
- Google Translate: ~200ms
- Google TTS: ~500ms
- Network overhead: ~200ms
- **Total: ~1.2s** (acceptable) — but can spike

## Tasks:

### Task 1: Voice Activity Detection (VAD)
Update agent:
- Detect when speaker starts/stops talking
- Only process audio when speech is detected
- Silence periods → skip (saves API calls)
- Use Deepgram's built-in endpointing or Silero VAD

### Task 2: Sentence Boundary Detection
- Don't translate mid-sentence
- Buffer audio until natural pause (endpointing)
- Deepgram's `endpointing` parameter: 300ms silence = sentence end
- Send complete sentences for better translation quality

### Task 3: Audio Chunk Optimization
- Optimal chunk size for streaming STT: 100-250ms
- Buffer management: don't send too small or too large chunks
- Overlap chunks slightly for better recognition

### Task 4: Fallback Mechanisms
If translation takes > 3 seconds:
- Play original audio (untranslated) immediately
- Show subtitle: "Translation delayed..."
- When translation arrives, show it as text only (don't interrupt audio)

If any API is down:
- STT fails → pass-through audio (no translation)
- Translation fails → show STT text only
- TTS fails → show translated text only, play original audio

### Task 5: Audio Quality
- Echo cancellation: ensure translated audio doesn't get picked up by mic
- Noise suppression on agent-generated TTS audio
- Volume normalization: TTS audio should match original volume level

### Task 6: Performance Monitoring
`agent/monitor.py`:
- Log latency for each pipeline step
- Average latency tracking
- Alert if latency > 3s consistently
- Dashboard endpoint: `GET /api/call/stats`

## Success Criteria:
- [ ] Average end-to-end latency < 2 seconds
- [ ] No mid-sentence translations
- [ ] Silence periods don't trigger unnecessary API calls
- [ ] Fallback works when APIs are slow
- [ ] No echo issues
- [ ] Latency stats visible

## Files to create/modify:
- `agent/monitor.py` (NEW)
- `src/app/api/call/stats/route.ts` (NEW)
- Update: `agent/translation_agent.py`
- Update: `agent/main.py`

## Next: Session 18
