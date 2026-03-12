# Session 06: Chat UI Layout (Contact List + Chat Window)

## Status: ✅ DONE
## Prerequisite: Session 05 completed (Auth working)

## Goal:
WhatsApp-style chat interface — বাম দিকে contact list, ডান দিকে chat window

## Before starting, tell Claude:
> "docs/SESSION_06.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Chat Layout
`/chat` page তৈরি করো — two-panel layout:
- Left panel (sidebar): Contact/conversation list
- Right panel (main): Chat messages + input

### Task 2: Contact List Component
`src/components/chat/ContactList.tsx`:
- User avatar + name
- Last message preview
- Unread count badge
- Online/offline indicator
- Search bar at top

### Task 3: Chat Window Component
`src/components/chat/ChatWindow.tsx`:
- Header: contact name + avatar + call button (disabled for now)
- Message area: scrollable message list
- Input area: text input + send button + mic button (disabled for now)

### Task 4: Message Bubble Component
`src/components/chat/MessageBubble.tsx`:
- Sent messages (right, blue)
- Received messages (left, grey)
- Each bubble shows: original text (small) + translated text (large)
- Timestamp
- Delivery status (sent, delivered, read)

### Task 5: API Routes for Contacts
- `GET /api/contacts` — get user's contacts
- `POST /api/contacts` — add contact by email
- `GET /api/conversations` — get conversations list

### Task 6: Responsive Design
- Mobile: full-width contact list, tap to open chat (back button to return)
- Desktop: side-by-side layout

## Success Criteria:
- [ ] Chat layout renders correctly
- [ ] Contact list shows contacts from database
- [ ] Clicking contact opens chat window
- [ ] Message bubbles display correctly
- [ ] Mobile responsive

## Files to create:
- `src/app/(main)/chat/page.tsx`
- `src/app/(main)/chat/layout.tsx`
- `src/components/chat/ContactList.tsx`
- `src/components/chat/ChatWindow.tsx`
- `src/components/chat/MessageBubble.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/chat/ChatHeader.tsx`
- `src/app/api/contacts/route.ts`
- `src/app/api/conversations/route.ts`

## Next: Session 07
