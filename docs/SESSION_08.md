# Session 08: Auto-Translation in Chat

## Status: DONE
## Prerequisite: Session 07 completed (Real-time messaging working)

## Goal:
Chat-এ message পাঠালে auto-translate হয়ে receiver তার ভাষায় দেখবে

## Before starting, tell Claude:
> "docs/SESSION_08.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Translation Middleware
Message send হলে server-side translation:
- Sender-এর language detect করো (user profile থেকে)
- Receiver-এর language check করো
- যদি আলাদা হয়, Google Translate API দিয়ে translate করো
- Original + translated দুটোই save করো

### Task 2: Update Message Model Flow
Send flow:
1. User types message → socket `send_message`
2. Server receives → translates → saves to DB (original + translated)
3. Server sends to receiver with both texts
4. Receiver-এর UI shows translated text as primary, original as secondary

### Task 3: Update MessageBubble
- Sent message: shows own language text (primary)
- Received message: shows translated text (primary), original (small, expandable)
- "Show original" toggle button

### Task 4: Translation Loading State
- Message bubble shows "Translating..." while translation happens
- Replace with translated text when ready
- If translation fails, show original with error indicator

### Task 5: Batch Translation
- পুরাতন message history load হলে batch translate করো (if not already translated)
- Cache translations in DB

## Success Criteria:
- [x] Bengali user sends → French user sees French text
- [x] French user sends → Bengali user sees Bengali text
- [x] Original text "Show original" toggle এ দেখা যায়
- [x] Translation fast (< 1 second for short messages)

## Files to modify/create:
- `src/lib/socket/server.ts` (add translation middleware)
- `src/services/translation.ts` (reuse existing)
- `src/components/chat/MessageBubble.tsx` (update)
- `src/app/api/messages/route.ts` (add translation)

## Next: Session 09
