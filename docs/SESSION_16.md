# Session 16: Live Subtitles During Calls

## Status: PENDING
## Prerequisite: Session 15 completed (Agent captures + translates audio)

## Goal:
Call চলাকালীন screen-এ live subtitles দেখানো — দুজনেরই কথা translate হয়ে text-এ দেখাবে

## Before starting, tell Claude:
> "docs/SESSION_16.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Architecture:
```
Agent (server) → transcribes audio → translates → sends data message to room
→ Client receives data message → shows subtitle on screen
```
LiveKit supports Data Messages — agent থেকে participants-কে text data পাঠানো যায়।

## Tasks:

### Task 1: Agent Data Channel
Update agent to send subtitles via LiveKit data channel:
```python
# After STT + translation:
room.local_participant.publish_data(
    json.dumps({
        "type": "subtitle",
        "speaker": participant_identity,
        "original": original_text,
        "translated": translated_text,
        "isFinal": is_final,
        "timestamp": time.time()
    }),
    reliable=True
)
```

### Task 2: Subtitle Component
`src/components/call/LiveSubtitles.tsx`:
- Overlay at bottom of call screen
- Shows current speaker's translated text
- Interim results in lighter color (partial)
- Final results in full color
- Auto-fade after 5 seconds of silence
- Max 2 lines visible at a time

### Task 3: Client Data Channel Listener
Update `useCall` hook:
- Listen for LiveKit data messages
- Parse subtitle JSON
- Filter: show only subtitles meant for this user
  - User A sees User B's speech translated to Bengali
  - User B sees User A's speech translated to French

### Task 4: Subtitle Settings
- Toggle subtitles on/off (button in call controls)
- Font size adjustment (small/medium/large)
- Position: bottom or top of screen
- Save preference in user settings

### Task 5: Subtitle History
- During call, keep a scrollable log of all subtitles
- Expandable panel on the side
- After call ends, save transcript to database

## Success Criteria:
- [ ] Call-এ কথা বললে অন্যজনের screen-এ translated subtitle দেখায়
- [ ] Interim (partial) results দেখায় real-time-এ
- [ ] Final results replace interim smoothly
- [ ] Subtitles auto-fade after silence
- [ ] Toggle on/off works

## Files to create/modify:
- `src/components/call/LiveSubtitles.tsx` (NEW)
- `src/components/call/SubtitleSettings.tsx` (NEW)
- Update: `agent/translation_agent.py`
- Update: `src/hooks/useCall.ts`
- Update: `src/components/call/ActiveCall.tsx`
- Update: `src/components/call/CallControls.tsx`

## Next: Session 17
