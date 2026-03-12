# Session 07: Real-time Messaging (Socket.io)

## Status: ✅ DONE
## Prerequisite: Session 06 completed (Chat UI ready)

## Goal:
Socket.io দিয়ে real-time message delivery — একজন পাঠালে অন্যজন সাথে সাথে পাবে

## Before starting, tell Claude:
> "docs/SESSION_07.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Socket.io Server Setup
Custom Next.js server with Socket.io অথবা separate socket server:
- `src/lib/socket/server.ts` — Socket.io server initialization
- Connection handling, room management
- Authentication middleware (verify JWT on connect)

### Task 2: Socket Events Design
Events:
- `join_conversation` — user joins a chat room
- `send_message` — send message to conversation
- `receive_message` — receive message from other user
- `typing` — typing indicator
- `message_delivered` — delivery confirmation
- `user_online` / `user_offline` — presence

### Task 3: Socket Client Hook
`src/hooks/useSocket.ts`:
- Connect to socket server with auth token
- Auto-reconnect
- Event listeners
- Clean disconnect on unmount

### Task 4: Message API Routes
- `POST /api/messages` — save message to database
- `GET /api/messages/[conversationId]` — get message history (paginated)

### Task 5: Integrate with Chat UI
- ChatInput → sends message via socket + saves to DB
- ChatWindow → listens for new messages via socket
- Typing indicator
- Auto-scroll on new message

### Task 6: Online Status
- Track who's online
- Show green dot on contact list
- "Last seen" for offline users

## Success Criteria:
- [ ] দুটো browser tab-এ দুজন login করে chat করতে পারে
- [ ] Message instantly দেখায় (no refresh needed)
- [ ] Typing indicator কাজ করে
- [ ] Online/offline status দেখায়
- [ ] Message history load হয় (pagination)

## Files to create:
- `src/lib/socket/server.ts`
- `src/lib/socket/events.ts`
- `src/hooks/useSocket.ts`
- `src/app/api/messages/route.ts`
- `src/app/api/messages/[conversationId]/route.ts`
- Update: `src/components/chat/ChatInput.tsx`
- Update: `src/components/chat/ChatWindow.tsx`
- Update: `src/components/chat/ContactList.tsx`

## Next: Session 08
