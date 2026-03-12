# Session 12: Voice Message UI Polish

## Status: PENDING
## Prerequisite: Session 11 completed (Voice pipeline working)

## Goal:
Voice message bubble-এ original/translated toggle, polished playback UI

## Before starting, tell Claude:
> "docs/SESSION_12.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Enhanced Voice Bubble
Update `VoiceMessageBubble.tsx`:
- Two tabs: "Original 🇧🇩" and "Translated 🇫🇷"
- Each tab plays respective audio
- Waveform visualization during playback (using stored audio)
- Duration display
- Smooth tab switching animation

### Task 2: Text Display Under Audio
- Below audio player, show text:
  - Original tab → original language text
  - Translated tab → translated language text
- Expandable/collapsible text section
- Copy text button

### Task 3: Processing State
- While voice is being translated:
  - Show "Translating voice message..." with spinner
  - Show partial results as they come (text first, then audio)
  - Smooth transition from loading → complete

### Task 4: Audio Player Component
`src/components/ui/AudioPlayer.tsx` (reusable):
- Play/pause toggle
- Progress bar (seekable)
- Duration / current time
- Playback speed (1x, 1.5x, 2x)
- Mini waveform visualization

### Task 5: Animations
- Smooth transition when message arrives
- Bubble expand animation
- Tab switch animation
- Loading skeleton for voice messages

## Success Criteria:
- [ ] Voice message bubble looks polished (WhatsApp-quality)
- [ ] Original/Translated tabs switch smoothly
- [ ] Audio player with progress bar works
- [ ] Text shows below audio
- [ ] Loading state is smooth, not jarring

## Files to create/modify:
- `src/components/ui/AudioPlayer.tsx` (NEW)
- Update: `src/components/voice/VoiceMessageBubble.tsx`
- Update: `src/components/chat/ChatWindow.tsx`

## Next: Session 13
