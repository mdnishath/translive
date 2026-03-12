# Session 21: Deployment (Railway + Vercel + LiveKit Cloud)

## Status: PENDING
## Prerequisite: Session 20 completed (Security done)

## Goal:
App live deploy করা — যেকোনো browser থেকে accessible

## Before starting, tell Claude:
> "docs/SESSION_21.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Deployment Architecture:
```
[Vercel] ← Frontend (Next.js SSR + API routes)
    ↕
[Railway] ← PostgreSQL database + Socket.io server + Agent
    ↕
[LiveKit Cloud] ← WebRTC rooms + media routing
```

## Tasks:

### Task 1: Prepare for Production
- Update `next.config.js` for production
- Build locally and verify: `npm run build && npm start`
- Fix any build warnings
- Remove console.log statements
- Set NODE_ENV=production

### Task 2: Database Migration (Railway)
- Create Railway account (railway.app)
- Create PostgreSQL instance on Railway
- Get DATABASE_URL from Railway
- Run `npx prisma migrate deploy` against production DB
- Verify tables created with Prisma Studio

### Task 3: Deploy Frontend to Vercel
- Connect GitHub repo to Vercel (or use CLI: `npx vercel`)
- Set environment variables on Vercel:
  - DEEPGRAM_API_KEY
  - GOOGLE_CLOUD_API_KEY
  - ANTHROPIC_API_KEY
  - DATABASE_URL (Railway PostgreSQL)
  - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
- Deploy and verify

### Task 4: Socket.io Server (Railway)
Socket.io needs a persistent server (not serverless):
- Create a separate Express + Socket.io server for deployment
- `server/` directory at project root
- Deploy to Railway as a separate service
- Update `NEXT_PUBLIC_SOCKET_URL` to point to Railway

### Task 5: LiveKit Cloud Setup
- Create LiveKit Cloud account (cloud.livekit.io)
- Get API key + secret
- Update environment variables
- Deploy agent to Railway (Python process)
- Verify agent connects to LiveKit Cloud rooms

### Task 6: Custom Domain (Optional)
- If user has a domain, configure on Vercel
- SSL/HTTPS automatic with Vercel
- DNS configuration

### Task 7: Post-Deploy Verification
Full test flow:
1. Open app on phone browser
2. Create two accounts
3. Send text messages → verify translation
4. Send voice message → verify translation
5. Make a call → verify real-time translation + subtitles
6. Test on different networks (not just same WiFi)

## Success Criteria:
- [ ] App accessible via public URL
- [ ] HTTPS working
- [ ] User registration + login works
- [ ] Text messaging + translation works
- [ ] Voice messaging + translation works
- [ ] Voice calling + real-time translation works
- [ ] App installable as PWA on phone
- [ ] Works on different networks/devices

## Files to create/modify:
- `server/index.ts` (standalone socket server)
- `server/package.json`
- `Procfile` or Railway config
- `vercel.json` (if needed)
- Update: `.env.local` → production values
- Various config files for deployment

## 🎉 PROJECT COMPLETE!
