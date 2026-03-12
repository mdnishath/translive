# Session 19: Dark Mode + Error Handling + Notifications

## Status: PENDING
## Prerequisite: Session 18 completed (Responsive + PWA done)

## Goal:
Dark/light mode toggle, proper error UX, notification sounds

## Before starting, tell Claude:
> "docs/SESSION_19.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Theme System
`src/context/ThemeContext.tsx`:
- Dark mode (default) / Light mode toggle
- Save preference in localStorage
- Respect system preference (`prefers-color-scheme`)
- CSS variables for all colors
- Tailwind `dark:` variant usage

### Task 2: Update All Components for Theme
- All components should use theme-aware colors
- No hardcoded colors — use CSS variables or Tailwind dark: classes
- Test both modes for all pages:
  - Login/Signup
  - Chat (contact list, messages, input)
  - Call screens
  - Profile page

### Task 3: Error Handling UX
`src/components/ui/Toast.tsx` — toast notification system:
- Success (green), Error (red), Warning (yellow), Info (blue)
- Auto-dismiss after 5 seconds
- Stack multiple toasts
- Position: top-right

Global error boundaries:
- `src/app/error.tsx` — app-level error boundary
- `src/app/not-found.tsx` — 404 page
- Network error → "Connection lost. Retrying..." toast
- API error → user-friendly message (not raw error)

### Task 4: Error Messages in Bengali + French
All user-facing errors should be bilingual:
- Based on user's language preference
- `src/lib/constants/messages.ts` — error message map
- Examples:
  - "Microphone access denied" → "মাইক্রোফোন অ্যাক্সেস অনুমতি দিন" / "Accès au microphone refusé"
  - "Connection lost" → "সংযোগ বিচ্ছিন্ন" / "Connexion perdue"

### Task 5: Notification Sounds
`public/sounds/` directory:
- `message.mp3` — new message received
- `call-incoming.mp3` — incoming call ringtone
- `call-outgoing.mp3` — outgoing call dialing tone
- `call-end.mp3` — call ended
- `notification.mp3` — generic notification

`src/lib/utils/sound.ts`:
- `playSound(soundName)` — play notification sound
- Respect user's mute preference
- Use Web Audio API for better control

### Task 6: Loading States
- Skeleton loaders for:
  - Contact list loading
  - Chat messages loading
  - Profile page loading
- Consistent loading spinner component

## Success Criteria:
- [ ] Dark/light mode toggle works, preference saved
- [ ] All pages look good in both modes
- [ ] Errors show friendly toast messages
- [ ] Error messages available in Bengali + French
- [ ] Notification sounds play at right moments
- [ ] Loading skeletons show while data loads

## Files to create:
- `src/context/ThemeContext.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/Skeleton.tsx`
- `src/lib/constants/messages.ts`
- `src/lib/utils/sound.ts`
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `public/sounds/*.mp3`

## Next: Session 20
