# Session 04: Database Setup (PostgreSQL + Prisma)

## Status: ✅ DONE
## Prerequisite: Session 03 completed (POC working)

## Goal:
PostgreSQL database + Prisma ORM setup করা, User ও Message model তৈরি করা

## Before starting, tell Claude:
> "docs/SESSION_04.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Install Prisma
```bash
npm install prisma @prisma/client
npx prisma init
```

### Task 2: Design Database Schema
`prisma/schema.prisma` এ models তৈরি করো:

**User model:**
- id, email, password (hashed), name, language (bn/fr), avatar, createdAt, updatedAt

**Conversation model:**
- id, createdAt, updatedAt
- participants (User relation)

**Message model:**
- id, content, translatedContent, senderId, conversationId
- messageType (text/voice/call)
- originalLanguage, translatedLanguage
- audioUrl, translatedAudioUrl (for voice messages)
- createdAt

**Contact model:**
- id, userId, contactId, createdAt

### Task 3: PostgreSQL Setup
- PostgreSQL install/running আছে কিনা check করো
- যদি না থাকে, Docker দিয়ে PostgreSQL চালাও বা local install guide দাও
- `.env.local` এ DATABASE_URL যোগ করো

### Task 4: Run Migration
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Task 5: Create DB Utility
`src/lib/db.ts` — Prisma client singleton (Next.js hot reload safe)

## Success Criteria:
- [ ] Prisma schema complete with all models
- [ ] Migration successful
- [ ] Prisma Studio (`npx prisma studio`) এ tables দেখা যায়
- [ ] DB utility file created

## Files to create/modify:
- `prisma/schema.prisma`
- `src/lib/db.ts`
- `.env.local` (add DATABASE_URL)

## Next: Session 05
