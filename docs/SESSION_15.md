# Session 15: Real-time Call Translation (LiveKit Agent) — Part A: Server Agent

## Status: PENDING
## Prerequisite: Session 14 completed (Call UI done)

## Goal:
LiveKit Agent তৈরি করা যেটা call-এ join করে audio capture করে translate করে

## Before starting, tell Claude:
> "docs/SESSION_15.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Architecture:
```
User A (Bengali) ←→ LiveKit Room ←→ User B (French)
                        ↕
                  Translation Agent
                  (captures audio from A,
                   translates to French,
                   plays to B, and vice versa)
```

The Agent is a server-side participant that:
1. Subscribes to both users' audio tracks
2. Sends audio chunks to Deepgram STT (streaming)
3. Gets transcribed text
4. Translates via Google Translate
5. Generates TTS audio
6. Publishes translated audio track to the other user

## Tasks:

### Task 1: LiveKit Agent Setup (Python)
LiveKit Agents SDK is Python-based:
```bash
pip install livekit-agents livekit-plugins-deepgram livekit-plugins-google
```
Create `agent/` directory at project root:
- `agent/main.py` — Agent entry point
- `agent/translation_agent.py` — Translation logic
- `agent/requirements.txt`

### Task 2: Agent Translation Pipeline
`agent/translation_agent.py`:
```python
class TranslationAgent:
    async def process_audio_stream(participant, language):
        # 1. Subscribe to participant's audio
        # 2. Stream to Deepgram STT
        # 3. On transcript received → translate
        # 4. Generate TTS
        # 5. Publish translated audio to room
```

### Task 3: Agent Auto-Join
When a call starts:
- Server creates LiveKit room
- Server dispatches agent to join room
- Agent gets room metadata (who speaks what language)
- Agent subscribes to both participants' audio

### Task 4: Audio Routing
Critical: the agent must route correctly:
- User A's audio → translate to User B's language → play to User B only
- User B's audio → translate to User A's language → play to User A only
- Use LiveKit's participant-specific track subscription

### Task 5: API Route for Agent Dispatch
`POST /api/call/agent`:
- Trigger agent to join a room
- Pass room name + participant languages
- Health check endpoint

### Task 6: Test Pipeline
- Start agent process
- Make a call between two users
- Verify agent joins room
- Verify audio is captured (check STT output in agent logs)
- Translation may not be smooth yet — just verify the pipeline works

## Success Criteria:
- [ ] Agent successfully joins LiveKit room when call starts
- [ ] Agent captures audio from both participants
- [ ] STT produces text (visible in agent logs)
- [ ] Translation happens (visible in logs)
- [ ] TTS audio generated (may have latency issues — ok for now)

## Files to create:
- `agent/main.py`
- `agent/translation_agent.py`
- `agent/requirements.txt`
- `agent/.env` (agent-specific env vars)
- `src/app/api/call/agent/route.ts`
- Update: `src/services/callService.ts`

## Next: Session 16
