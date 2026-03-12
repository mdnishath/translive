# TransLive

**Real-time multilingual messaging — Bengali ↔ French, instantly.**

TransLive is a production-grade chat application that automatically translates every message between Bengali (বাংলা) and French (Français) in real time, so users who speak different languages can have natural conversations without switching apps or copying text.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Commit History & Versioning](#commit-history--versioning)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

| Category | Details |
|---|---|
| **Real-time chat** | WebSocket-based messaging via Socket.io (polling → WebSocket upgrade) |
| **Auto-translation** | Every incoming message is translated using the Deepgram-backed AI pipeline |
| **Presence** | Live online/offline indicators — updates within milliseconds |
| **Typing indicators** | Throttled (≤ 1 event/sec) to avoid server flooding |
| **Optimistic UI** | Messages appear instantly; replaced by server-confirmed versions |
| **Failure recovery** | 15-second watchdog per message; failed messages show a Retry button |
| **Pagination** | Cursor-based infinite scroll — load 50 messages at a time |
| **State management** | Zustand store — components subscribe to only the slice they need |
| **Auth** | HttpOnly JWT cookie — XSS-proof session management |
| **Offline fallback** | Falls back to REST API when WebSocket is disconnected |
| **Accessibility** | ARIA labels, `role="list"`, `dir="auto"` for Bengali RTL text |
| **Security** | CORS restricted to app domain, env validation at boot, rate limiting |

---

## Tech Stack

### Frontend

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | File-based routing, React Server Components, edge-ready |
| Language | **TypeScript** | End-to-end type safety |
| Styling | **Tailwind CSS v4** | Utility-first, zero runtime CSS |
| State | **Zustand** | Lightweight, selector-based — no unnecessary re-renders |
| Real-time | **Socket.io-client** | Auto-reconnect, transport fallback |

### Backend

| Layer | Choice | Why |
|---|---|---|
| Server | **Node.js + custom server.ts** | Co-hosts Next.js and Socket.io on one port |
| Real-time | **Socket.io v4** | Room-based broadcasting, HttpOnly-cookie auth |
| Database | **PostgreSQL + Prisma** | Type-safe ORM, migrations as code |
| Auth | **JWT (HS256)** via `jsonwebtoken` | Stateless, HttpOnly-cookie delivery |
| Translation | **Deepgram AI** | Low-latency speech and text understanding |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App Router                  │
│  /app/chat/page.tsx  →  ChatWindow  →  MessageBubble    │
│               ↕ Zustand chatStore                       │
│  ContactList (subscribes to conversations + presence)   │
└───────────────────────────┬─────────────────────────────┘
                            │ Socket.io (cookie-auth)
┌───────────────────────────▼─────────────────────────────┐
│                     server.ts                           │
│  Socket.io Server  ←→  Prisma  ←→  PostgreSQL           │
│  - CORS: NEXT_PUBLIC_APP_URL only                       │
│  - Rate limit: 10 msgs / 5 sec per user                 │
│  - Room: conv:<conversationId>                          │
└─────────────────────────────────────────────────────────┘
```

### Message Flow

```
User types → optimistic bubble (temp-id) → socket.sendMessage()
                                                  ↓
                                        server.ts saves to DB
                                                  ↓
                          ┌───────────────────────┴──────────────────────┐
                    message_saved                                  receive_message
                    (to sender)                                   (to other user)
                          ↓                                               ↓
               replace temp bubble                            append real bubble
               update sidebar preview                         update sidebar preview
```

### Zustand State Architecture

```
chatStore
├── conversations[]          ← fetched via REST, mutated by socket events
├── onlineUserIds (Set)      ← driven by user_online / user_offline events
└── unreadCounts {}          ← incremented on receive, cleared on open

ChatPage      → dispatches actions only (no subscription — prevents re-renders)
ContactList   → subscribes to conversations + onlineUserIds + unreadCounts
ChatWindow    → subscribes to onlineUserIds (for the specific contact only)
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- PostgreSQL (local or hosted — e.g. Supabase, Neon, Railway)
- A `.env.local` file with the variables listed below

### Installation

```bash
git clone https://github.com/mdnishath/translive.git
cd translive
npm install
```

### Database Setup

```bash
npx prisma migrate dev   # apply migrations & create schema
npx prisma generate      # regenerate Prisma client types
```

### Running Locally

```bash
npx tsx server.ts        # starts Next.js + Socket.io together on port 3000
```

Open [http://localhost:3000](http://localhost:3000) in **two separate browser windows** and sign in with two different accounts to see real-time translation in action.

---

## Environment Variables

Create `.env.local` in the project root:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/translive"

# JWT signing secret — use a long random string in production
JWT_SECRET="your-secret-key-minimum-32-characters"

# Deepgram API key for translation
DEEPGRAM_API_KEY="your-deepgram-api-key"

# Full public URL of your app — used for CORS (no trailing slash)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# Production example:
# NEXT_PUBLIC_APP_URL="https://translive.yourdomain.com"

# Server port (optional, defaults to 3000)
PORT=3000
```

> **Security:** `.env.local` is excluded by `.gitignore`. Never commit secrets.

---

## Project Structure

```
translive/
├── server.ts                         # Custom Node server — Next.js + Socket.io on one port
├── prisma/
│   ├── schema.prisma                 # Database schema (User, Conversation, Message)
│   └── migrations/                   # Version-controlled SQL migrations
└── src/
    ├── app/
    │   ├── (auth)/                   # Login & Register pages
    │   ├── api/
    │   │   ├── auth/                 # /login /register /logout /me
    │   │   ├── contacts/             # POST /contacts — add by email
    │   │   └── conversations/
    │   │       └── [id]/messages/    # GET (cursor-paginated) + POST
    │   ├── chat/page.tsx             # Main chat — socket orchestration + store dispatch
    │   └── profile/                  # Language & account settings
    ├── components/chat/
    │   ├── ChatWindow.tsx            # Message list, send, typing, pagination
    │   ├── ContactList.tsx           # Sidebar — reads directly from Zustand store
    │   ├── ChatHeader.tsx            # Contact info, online status, call buttons
    │   ├── MessageBubble.tsx         # Message + translation, failed/retry UI
    │   └── ChatInput.tsx             # Text input + voice recording button
    ├── context/AuthContext.tsx       # Current user session
    ├── hooks/useSocket.ts            # Socket.io hook — stable memoized actions
    ├── lib/
    │   ├── auth.ts                   # JWT sign/verify helpers
    │   ├── db.ts                     # Prisma singleton
    │   ├── socket/events.ts          # Shared socket event name constants
    │   └── utils/avatar.ts           # Deterministic gradient + initials (DRY)
    ├── services/                     # Translation service wrappers
    ├── store/chatStore.ts            # Zustand — conversations, presence, unread
    └── types/                        # Shared TypeScript interfaces
```

---

## Commit History & Versioning

This project uses **semantic commit messages** for a clean, navigable history:

| Prefix | Meaning |
|---|---|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `refactor:` | Internal improvement with no behavior change |
| `perf:` | Performance improvement |
| `chore:` | Build tooling, dependencies, config |

### Rolling Back

Every commit is a stable, working checkpoint:

```bash
git log --oneline              # see the full history
git checkout <hash>            # inspect any past version (detached HEAD)
git revert <hash>              # safely undo a commit without rewriting history
git checkout main              # return to the latest version
```

---

## Roadmap

- [ ] **Voice messages** — record + playback in-chat (Deepgram STT)
- [ ] **Video & voice calls** — WebRTC peer-to-peer with translation overlay
- [ ] **Push notifications** — Web Push API for offline messages
- [ ] **Read receipts** — delivered / seen double-tick indicators
- [ ] **Message reactions** — emoji reactions with real-time sync
- [ ] **Group chats** — multi-participant rooms with per-user language preferences
- [ ] **Media sharing** — images and documents with OCR translation
- [ ] **Mobile apps** — React Native sharing the same backend

---

## License

MIT — free to use, modify, and distribute.

---

<div align="center">
  <strong>Built for cross-cultural communication</strong><br/>
  🇧🇩 বাংলা &nbsp;·&nbsp; 🇫🇷 Français
</div>
