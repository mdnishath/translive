# Session 18: Responsive Design + PWA

## Status: PENDING
## Prerequisite: Session 17 completed (Call quality optimized)

## Goal:
সব screen size-এ কাজ করবে + phone-এ install করা যাবে (PWA)

## Before starting, tell Claude:
> "docs/SESSION_18.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Mobile-First Responsive
Audit and fix all pages for mobile (375px width):
- **Chat page:** Single panel — contact list OR chat window, not both
  - Contact list → tap → full-screen chat → back button returns
- **Call screens:** Already full-screen, verify controls don't overlap
- **Login/Signup:** Stack forms vertically, full-width inputs
- **Profile page:** Single column layout

### Task 2: Tablet Layout (768px)
- Chat: side-by-side possible but narrower sidebar
- Forms: centered with max-width

### Task 3: Desktop Layout (1280px+)
- Chat: generous sidebar + chat area
- Max-width container to prevent stretching

### Task 4: PWA Configuration
Create PWA manifest and service worker:
- `public/manifest.json` — app name, icons, theme color, display: standalone
- App icons: 192x192, 512x512 (generate from logo or placeholder)
- `next.config.js` — PWA plugin or manual service worker
- Install prompt on mobile browsers

### Task 5: Offline Support (Basic)
- Cache static assets (CSS, JS, images)
- Show "You're offline" message when no network
- Queue messages when offline, send when reconnected

### Task 6: Touch Interactions
- Swipe gestures on mobile:
  - Swipe right on chat → back to contact list
  - Long press on message → context menu (copy, reply)
- Touch-friendly button sizes (min 44px)
- Proper viewport meta tag

## Success Criteria:
- [ ] App looks good on phone (375px), tablet (768px), desktop (1280px)
- [ ] Chat layout switches between single/dual panel based on screen
- [ ] PWA installable on Android/iOS Safari
- [ ] Offline message shows when disconnected
- [ ] Touch interactions feel native

## Files to create/modify:
- `public/manifest.json` (NEW)
- `public/icons/` (NEW — app icons)
- Update: all component files for responsive
- Update: `src/app/layout.tsx` (viewport meta, manifest link)
- Update: `next.config.js` (PWA config if needed)

## Next: Session 19
