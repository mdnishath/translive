# Session 05: User Authentication (Signup, Login, JWT)

## Status: ✅ DONE
## Prerequisite: Session 04 completed (Database ready)

## Goal:
User registration, login, JWT-based auth system তৈরি

## Before starting, tell Claude:
> "docs/SESSION_05.md পড়ো এবং সেই অনুযায়ী কাজ করো"

## Tasks:

### Task 1: Install Auth Packages
```bash
npm install bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken
```

### Task 2: Auth Utility Functions
`src/lib/auth.ts` তৈরি করো:
- `hashPassword(password)` — bcrypt hash
- `comparePassword(password, hash)` — verify
- `generateToken(userId)` — JWT token create
- `verifyToken(token)` — JWT token verify
- `getAuthUser(request)` — middleware: request থেকে user বের করা

### Task 3: Auth API Routes
- `POST /api/auth/signup` — new user registration (email, password, name, language)
- `POST /api/auth/login` — login, return JWT token
- `GET /api/auth/me` — get current user from token
- `POST /api/auth/logout` — clear token

### Task 4: Auth UI Pages
- `/signup` page — registration form (name, email, password, language select)
- `/login` page — login form (email, password)
- Shared `AuthForm` component for both

### Task 5: Auth Context
`src/context/AuthContext.tsx` — React context for:
- Current user state
- Login/logout functions
- Auto-check token on page load
- Protected route wrapper component

### Task 6: Profile Page
- `/profile` page — show user info, change language preference

## Success Criteria:
- [ ] Signup করলে user database-এ save হয়
- [ ] Login করলে JWT token পায়
- [ ] Protected pages-এ token ছাড়া ঢুকতে পারে না
- [ ] Language preference save হয়
- [ ] Logout কাজ করে

## Files to create:
- `src/lib/auth.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/context/AuthContext.tsx`
- `src/components/ui/AuthForm.tsx`

## Next: Session 06
