# Session 13: WebRTC Basic Call Setup (LiveKit)

## Status: PENDING
## Prerequisite: Session 12 completed (Voice messages done)

## Goal:
দুজনের মধ্যে basic audio call — translation ছাড়া, শুধু call establish

## Before starting, tell Claude:
> "docs/SESSION_13.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Important Context:
এই session-এ শুধু call connect করা। Translation পরের session-এ হবে।
LiveKit ব্যবহার করবো কারণ:
- Open source WebRTC framework
- Built-in TURN/STUN servers
- Room-based architecture (perfect for 1:1 calls)
- Server-side Agent support (Phase 4 translation এর জন্য)

## Tasks:

### Task 1: Install LiveKit
```bash
npm install livekit-client livekit-server-sdk
```
- LiveKit Cloud account setup (livekit.io — free tier)
- অথবা Docker দিয়ে local LiveKit server
- `.env.local` এ LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET যোগ করো

### Task 2: LiveKit Token API
`POST /api/call/token` route:
- JWT token generate করো LiveKit server SDK দিয়ে
- Token-এ room name + participant identity encode
- Room naming: `call_{minUserId}_{maxUserId}` (consistent for same pair)

### Task 3: Call Service
`src/services/callService.ts`:
- `createRoom(callerId, receiverId)` → room create + return token
- `joinRoom(roomName, userId)` → return token for joining
- `endCall(roomName)` → room delete

### Task 4: Call Signaling via Socket
Socket events for call flow:
- `call_initiate` → caller sends to server → server notifies receiver
- `call_incoming` → server sends to receiver
- `call_accept` → receiver accepts → both get LiveKit tokens
- `call_reject` → receiver rejects → caller notified
- `call_end` → either party ends → both disconnected
- `call_busy` → receiver already on another call

### Task 5: useCall Hook
`src/hooks/useCall.ts`:
- Connect to LiveKit room
- Handle audio tracks (local + remote)
- Mute/unmute
- Call duration timer
- Connection state management
- Clean disconnect

### Task 6: Test Locally
- দুটো browser tab-এ দুজন login করো
- একজন call করো, অন্যজন accept করো
- দুজনেই কথা শুনতে পায় কিনা verify করো

## Success Criteria:
- [ ] User A can call User B
- [ ] User B sees incoming call notification
- [ ] Accept → both hear each other
- [ ] Reject → caller notified
- [ ] Mute/unmute works
- [ ] End call works from both sides
- [ ] Call duration shows

## Files to create:
- `src/app/api/call/token/route.ts`
- `src/services/callService.ts`
- `src/hooks/useCall.ts`
- `src/lib/socket/callEvents.ts`
- Update: `src/lib/socket/server.ts`
- Update: `.env.local` (add LiveKit keys)

## Next: Session 14
