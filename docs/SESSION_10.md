# Session 10: Voice Recording UI

## Status: PENDING
## Prerequisite: Session 09 completed (Smart translation working)

## Goal:
WhatsApp-এর মতো hold-to-record voice message feature + waveform animation

## Before starting, tell Claude:
> "docs/SESSION_10.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Voice Record Button
ChatInput-এ mic button যোগ করো:
- Text input empty থাকলে mic button দেখাবে
- Text থাকলে send button দেখাবে (WhatsApp-style)

### Task 2: Hold-to-Record Interaction
- Press and hold → recording starts
- Release → recording stops and sends
- Slide left → cancel recording
- Visual: recording duration timer + red dot animation

### Task 3: Waveform Visualization
`src/components/voice/WaveformVisualizer.tsx`:
- Real-time audio waveform while recording
- Use Web Audio API (AnalyserNode)
- Smooth animated bars

### Task 4: Audio Processing
- Record using MediaRecorder API
- Format: WebM/Opus
- Upload audio blob to server
- Store in `/uploads/voice/` folder
- Save file path in Message model

### Task 5: Voice Message API
- `POST /api/voice/upload` — upload audio file, return URL
- Update Message model to support audioUrl field
- Update socket `send_message` to handle voice type

### Task 6: Voice Message Bubble
`src/components/voice/VoiceMessageBubble.tsx`:
- Play button + waveform + duration
- Different from text message bubble
- Loading state while processing

## Success Criteria:
- [ ] Hold mic button → records audio
- [ ] Waveform shows while recording
- [ ] Duration timer shows
- [ ] Slide left cancels
- [ ] Voice message appears in chat as audio bubble
- [ ] Play button works

## Files to create:
- `src/components/voice/WaveformVisualizer.tsx`
- `src/components/voice/VoiceMessageBubble.tsx`
- `src/hooks/useVoiceRecorder.ts`
- `src/app/api/voice/upload/route.ts`
- Update: `src/components/chat/ChatInput.tsx`
- Update: `src/components/chat/MessageBubble.tsx`

## Next: Session 11
