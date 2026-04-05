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

- **Marketing site** — `/` is a **static-friendly landing page** for visitors (`components/landing/`). **Signed-in users are redirected to `/dashboard`** by middleware so they never see the marketing home.
- **Supabase** — Browser and server clients (`apps/web/lib/supabase/`), session refresh via middleware.
- **Authentication** — Email/password and Google sign-in on login; sign-up with validation; auth callback route; protected dashboard routes.
- **Onboarding** — After first login: create a business, set branding (logo URL, brand color), choose business type and currency; links the user to the business.
- **Dashboard**
  - **Stock** — Items with purchase vs usage units, conversion ratio, cost per usage unit; restock in purchase units; low-stock thresholds.
  - **Production** — Batches with ingredient/packaging lines; stock deductions and batch cost via `create_production_batch` RPC; safe delete restores stock.
  - **Sales** — Optional batch link for COGS; gross profit; charts.
  - **Summary** — Revenue, COGS, profit, alerts, monthly spend by item (RPC).

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

   Run these in order on your Supabase project (SQL editor or CLI):

   1. `packages/supabase/migrations/20260403000000_init_schema.sql`
   2. `packages/supabase/migrations/20260403000001_create_business_rpc.sql`
   3. `packages/supabase/migrations/20260403000002_bakery_business_logic.sql` (batch RPCs, item units, spend insights)

   Then `packages/supabase/seed/units.sql` for the units lookup table.

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
