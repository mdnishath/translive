# Session 20: Security Hardening

## Status: PENDING
## Prerequisite: Session 19 completed

## Goal:
Production-ready security — rate limiting, input validation, HTTPS, CSRF protection

## Before starting, tell Claude:
> "docs/SESSION_20.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Environment Variables Audit
- Verify ALL API keys are in `.env.local` only
- No API keys in frontend code (check with grep)
- No API keys in git history
- `.env.local` is in `.gitignore`

### Task 2: Input Validation
Install and configure validation:
```bash
npm install zod
```
- Validate all API route inputs with Zod schemas
- `src/lib/validation/` — schema definitions
- Sanitize user inputs (XSS prevention)
- Max message length: 5000 characters
- Max audio file size: 10MB

### Task 3: Rate Limiting
`src/lib/rateLimit.ts`:
- Per-user rate limiting using in-memory store
- Limits:
  - API routes: 100 requests/minute per user
  - Auth routes: 10 requests/minute per IP (brute force prevention)
  - Translation: 30 requests/minute
  - Voice upload: 10 requests/minute
- Return 429 Too Many Requests when exceeded

### Task 4: Authentication Hardening
- JWT token expiration: 7 days
- Refresh token mechanism
- Password requirements: min 8 chars, 1 uppercase, 1 number
- Account lockout after 5 failed login attempts (15 min)
- Secure cookie settings (httpOnly, secure, sameSite)

### Task 5: Security Headers
Next.js `next.config.js` security headers:
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (restrict camera, geolocation, etc.)

### Task 6: File Upload Security
- Validate file types (only audio: webm, mp3, wav, ogg)
- Validate file size (max 10MB)
- Generate random filenames (don't use user-provided names)
- Store outside public folder if possible
- Scan for malicious content

## Success Criteria:
- [ ] No API keys exposed in frontend bundle
- [ ] All inputs validated with Zod
- [ ] Rate limiting active on all routes
- [ ] JWT refresh mechanism works
- [ ] Security headers present in responses
- [ ] File uploads validated and secured

## Files to create/modify:
- `src/lib/validation/` (NEW directory with schemas)
- `src/lib/rateLimit.ts` (NEW)
- `src/middleware.ts` (NEW — Next.js middleware for security)
- Update: `next.config.js`
- Update: all API routes (add validation)
- Update: `src/lib/auth.ts`

## Next: Session 21
