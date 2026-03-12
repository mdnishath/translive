# Session 14: Call UI (Screens + Controls)

## Status: PENDING
## Prerequisite: Session 13 completed (Basic call works)

## Goal:
Professional call UI — incoming call screen, active call screen, all controls

## Before starting, tell Claude:
> "docs/SESSION_14.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Incoming Call Screen
`src/components/call/IncomingCall.tsx`:
- Full-screen overlay (semi-transparent dark background)
- Caller avatar (large, centered)
- Caller name
- "Incoming call..." text with pulse animation
- Accept button (green, with phone icon)
- Reject button (red, with phone-down icon)
- Ringtone audio (use Web Audio API or simple audio file)

### Task 2: Active Call Screen
`src/components/call/ActiveCall.tsx`:
- Full-screen call interface
- Other person's avatar (large)
- Their name
- Call duration timer (MM:SS format)
- Connection quality indicator (good/medium/poor)
- Bottom control bar:
  - Mute/Unmute button
  - Speaker toggle
  - End call button (red)

### Task 3: Outgoing Call Screen
`src/components/call/OutgoingCall.tsx`:
- Shows while waiting for receiver to accept
- Receiver avatar + name
- "Calling..." text with animation
- Cancel button
- Ringing sound effect

### Task 4: Call Button in Chat
- Add phone icon button in ChatHeader
- Click → initiate call to current contact
- Disabled if already on call

### Task 5: Call Notification System
`src/components/call/CallNotification.tsx`:
- If user is in chat with someone else, show floating notification
- "User X is calling" with accept/reject
- Auto-dismiss after 30 seconds (missed call)

### Task 6: Call History
- Log calls in database (caller, receiver, duration, status)
- Show missed calls in contact list

## Success Criteria:
- [ ] Incoming call screen shows with animations
- [ ] Outgoing call shows "Calling..." state
- [ ] Active call shows duration, controls work
- [ ] Call can be initiated from chat header
- [ ] Mute, speaker toggle, end call all work
- [ ] Professional look and feel

## Files to create:
- `src/components/call/IncomingCall.tsx`
- `src/components/call/ActiveCall.tsx`
- `src/components/call/OutgoingCall.tsx`
- `src/components/call/CallControls.tsx`
- `src/components/call/CallNotification.tsx`
- Update: `src/components/chat/ChatHeader.tsx`

## Next: Session 15
