# TransLive — Session-wise Development Guide

## Project: Bengali ↔ French Real-Time Translation App
## Owner: Nishath | Started: March 2026

---

## How to Use This Guide

প্রতিটা session-এ নতুন Claude Code conversation শুরু করো।
শুরুতে বলো: **"docs/SESSION_XX.md পড়ো এবং সেই অনুযায়ী কাজ করো"**
Session শেষে Claude তোমাকে বলবে পরের session কোনটা।

**Important for Claude:** প্রতিটা session-এর README-তে exact file paths, tasks, এবং success criteria দেওয়া আছে। সেগুলো follow করো। কাজ শেষে session file-এ status "DONE" করে দাও এবং কী কী হলো সেটা update করো।

---

## Session Map (21 Sessions, ~5 Phases)

### Phase 0+1: Setup + POC
| # | Session | Status | Est. Time |
|---|---------|--------|-----------|
| 01 | Project init, folder structure, env setup | ✅ DONE | 30 min |
| 02 | API routes + POC UI components | ✅ DONE | 45 min |
| 03 | API keys setup + POC testing + bug fixes | ✅ DONE | 1 hr |

### Phase 2: Messaging App
| # | Session | Status | Est. Time |
|---|---------|--------|-----------|
| 04 | Database setup (PostgreSQL + Prisma schema) | ✅ DONE | 1 hr |
| 05 | User Authentication (signup, login, JWT) | ✅ DONE | 1.5 hr |
| 06 | Chat UI (contact list + chat window layout) | ✅ DONE | 1.5 hr |
| 07 | Real-time messaging (Socket.io) | ✅ DONE | 1.5 hr |
| 08 | Auto-translation in chat messages | ✅ DONE | 1 hr |
| 09 | Smart translation (Claude API + caching) | ✅ DONE | 1 hr |

### Phase 3: Voice Messages
| # | Session | Status | Est. Time |
|---|---------|--------|-----------|
| 10 | Voice recording UI (hold-to-record + waveform) | ✅ DONE | 1.5 hr |
| 11 | Voice message pipeline (STT → Translate → TTS) | ⬜ PENDING | 1.5 hr |
| 12 | Voice message UI polish + playback | ⬜ PENDING | 1 hr |

### Phase 4: Voice Calling (hardest)
| # | Session | Status | Est. Time |
|---|---------|--------|-----------|
| 13 | WebRTC setup (LiveKit + basic audio call) | ⬜ PENDING | 2 hr |
| 14 | Call UI (incoming/outgoing, controls) | ⬜ PENDING | 1.5 hr |
| 15 | Real-time call translation (LiveKit Agent) | ⬜ PENDING | 2 hr |
| 16 | Live subtitles during calls | ⬜ PENDING | 1.5 hr |
| 17 | Call quality optimization | ⬜ PENDING | 1.5 hr |

### Phase 5: Polish & Deploy
| # | Session | Status | Est. Time |
|---|---------|--------|-----------|
| 18 | Responsive design + PWA | ⬜ PENDING | 1.5 hr |
| 19 | Dark mode + error handling + notifications | ⬜ PENDING | 1.5 hr |
| 20 | Security hardening | ⬜ PENDING | 1 hr |
| 21 | Deployment (Railway + Vercel + LiveKit Cloud) | ⬜ PENDING | 2 hr |

---

## Tech Stack
- **Frontend:** Next.js 16, React, Tailwind CSS, TypeScript
- **Backend:** Next.js API Routes (serverless) + Express (Socket.io)
- **Database:** PostgreSQL + Prisma ORM
- **Real-time:** Socket.io (chat), LiveKit/WebRTC (calling)
- **APIs:** Deepgram (STT), Google Cloud (Translation + TTS), Anthropic (smart translation)

## Rules for Claude
- Best practices always — production-level code
- DRY — no code repetition, reuse existing services/hooks/utils
- TypeScript strict mode
- API keys always in .env.local, never exposed to frontend
- Existing file structure: check `src/` before creating new files
- Reuse existing types from `src/types/index.ts`
- Reuse existing constants from `src/lib/constants/index.ts`
- Reuse existing services from `src/services/`
