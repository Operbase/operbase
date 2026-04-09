# Operbase

Multi-tenant operations platform for small businesses. The first vertical is bakeries: inventory (ingredients and packaging), production batches, and sales. Data is isolated per business with Supabase Row Level Security.

## Tech stack

| Layer | Choice |
|--------|--------|
| App | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui |
| Backend | Supabase (Postgres, Auth, RLS) |
| Tests | Vitest, Testing Library |

## What’s in the app

- **Marketing site** — `/` landing page for visitors. Signed-in users are redirected to `/dashboard` by middleware.
- **Authentication** — Email/password and Google sign-in; strong password validation; auth callback route; protected dashboard routes.
- **Onboarding** — Create a business, set branding (logo, brand color), choose business type and currency.
- **Dashboard**
  - **"What happened today?" bar** — three-tap inline quick-log (I bought / I made / I sold) pinned to every dashboard page. Shows profit feedback with emotional tone; remembers your best sale via localStorage.
  - **Stock** — Ingredients + packaging with purchase/usage unit conversion and FIFO purchase lots. Low-stock thresholds.
  - **Production** — Runs with optional ingredient tracking; FIFO stock deduction; cost of goods; dispose units (given out, spoiled, didn’t sell).
  - **Sales** — Optional batch linkage for exact COGS; quick sale falls back to weighted average cost; gross profit per sale.
  - **Products** — Catalog with variants and add-ons; sale price, avg production cost, profit/unit, margin % per product and variant.
  - **Insights** — Period-filtered revenue, production cost, gross profit, margin; smart insight cards; per-product/variant breakdown.
  - **Global Quick Log** — Floating FAB: I made, I sold, I bought, I used, I gave away.
  - **Dashboard home** — Today’s profit, at-risk unsold items, money in/kept cards, monthly spend chart, rule-based AI assistant.

For file-level pointers, conventions, middleware behavior, and **caveats about the landing page** (it was inspired by a reference export but **not implemented as a pixel-perfect copy** — see “Marketing landing page”), read [`docs/AGENTS.md`](./docs/AGENTS.md). Product phases, scope, and internal API direction: [`docs/roadmap.md`](./docs/roadmap.md). A short entry point for tools that expect a root file: [`AGENTS.md`](./AGENTS.md).

## Repository layout

```
operbase/
├── apps/
│   └── web/                 # Next.js app
├── packages/
│   └── supabase/
│       ├── migrations/      # Run on your Supabase project
│       └── seed/            # e.g. units lookup
└── .github/                 # CI workflows
```

## Supabase projects

| Environment | Project reference |
|-------------|-------------------|
| Development | `hplsdhcxlvmwvvskxwfe` (operbase-dev) |
| Production  | `usbdxwddcxqwhhwxkbwq` (operbase) |

## Getting started

1. **Install dependencies**

   ```bash
   cd apps/web && npm install
   ```

2. **Environment variables**

   Copy `apps/web/.env.example` to `apps/web/.env.local` and set:

   - `NEXT_PUBLIC_SUPABASE_URL` — e.g. `https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key from the Supabase dashboard
   - `NEXT_PUBLIC_SITE_URL` — optional; your public site URL in production (better Open Graph / metadata; on Vercel, `VERCEL_URL` is used as a fallback)

3. **Database**

   Push all migrations to your Supabase project (CLI preferred):

   ```bash
   cd packages/supabase && supabase db push
   ```

   Or run each file in `packages/supabase/migrations/` in order (000000 → 000020), then `packages/supabase/seed/units.sql`. See `docs/AGENTS.md` for the full ordered list.

4. **Run the app**

   ```bash
   cd apps/web && npm run dev
   ```

5. **Tests**

   ```bash
   cd apps/web && npm test
   ```

   Coverage: `npm run test:coverage`, watch mode: `npm run test:watch`.

## Typical flow

**Visitor:** Open `/` → read marketing page → **Sign up** or **Log in**.

**New user:** Sign up → verify email if required → log in → **Onboarding** (create business) → **Dashboard**.

**Returning user:** Log in → **Dashboard** (middleware sends signed-in users away from `/`, `/login`, and `/signup`).

Unauthenticated users cannot access `/dashboard` or `/onboarding`. Users with a session but no business row are sent from `/dashboard` to `/onboarding`.

## Deploying (e.g. Vercel)

Connect the **Next.js app** at `apps/web` (or the repo root if that is how the project is configured). No special config is required beyond env vars. Set `NEXT_PUBLIC_SITE_URL` to your production domain for correct absolute URLs in metadata.
