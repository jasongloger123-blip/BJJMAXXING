# AGENTS.md: BJJMAXXING

Brazilian Jiu-Jitsu skill-tracker. Next.js 14 + Supabase + Stripe.

## Dev Commands

```bash
npm install          # after cloning
npm run dev          # localhost:3000
npm run build        # production build
npm run lint         # ESLint only (no typecheck script)
```

## Environment Setup

Copy `.env.example` to `.env` and fill in:

Required for local dev:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional: Stripe keys, Google Maps API key.

## Architecture

### Route Groups

- `app/(app)/` — Protected product routes (auth-guarded via `lib/supabase/middleware.ts`)
- `app/api/` — Server routes (Auth, Reviews, Stripe webhooks, Progress)
- `app/login`, `app/register` — Public auth pages

Protected paths defined in `lib/supabase/middleware.ts`:
`/onboarding`, `/skill-tree`, `/node`, `/profile`, `/gameplan`, `/erweitern`, `/notifications`

### Supabase Access Patterns

| Context | Import From |
|---------|-------------|
| Browser | `lib/supabase/client.ts` |
| Server Component | `lib/supabase/server.ts` |
| Middleware | `lib/supabase/middleware.ts` (auth redirects live here) |
| Admin/Backend | `lib/supabase/admin.ts` |

## Tailwind Custom Theme

Project extends default theme in `tailwind.config.js`:

- Colors: `bjj-bg`, `bjj-surface`, `bjj-panel`, `bjj-orange`, `bjj-gold`, `bjj-text`, `bjj-muted`
- Gradients: `hero-gradient`, `orange-glow`, `card-gradient`
- Shadows: `orange-glow`, `card`

Custom CSS classes defined in `app/globals.css`:
- `.glass` — backdrop blur panel
- `.shimmer` — animated loading shimmer
- `.queue-response-actions` — styled training queue buttons
- `.clip-card-shell` / `.clip-card-stage` — clip card styling

## Database Migrations

Located at `supabase/migrations/`. Naming: `YYYYMMDD_description.sql`

Apply locally via Supabase CLI or deploy via Supabase dashboard.

## Key Conventions

- **Language**: German UI (`lang="de"` in root layout)
- **Images**: YouTube thumbnails allowed via `next.config.js` remotePatterns
- **Auth**: Protected routes redirect to `/login`; authenticated users redirect away from `/login` and `/register`
- **Import alias**: `@/*` maps to root (`./`)
- **No test runner configured**: Project has no `test` script in package.json

## Type Safety

Strict TypeScript enabled. `tsconfig.tsbuildinfo` is tracked (incremental builds).
