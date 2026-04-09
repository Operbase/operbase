# Operbase — Agent Guide

This file is for AI coding assistants (Claude Code, Cursor, Windsurf, Copilot, Codex, etc.).
Read it before making any changes.

It is **curated, not exhaustive**: it explains structure, conventions, and important paths — not every component or migration detail. The repo and SQL migrations are the source of truth for exact columns, policies, and file lists.

### Roadmap & phase scope

**Prompt (copy for tools):**

Refer to `docs/roadmap.md` for:

- current phase  
- allowed scope  
- API structure  

Do not implement features outside the current phase.

From this folder, open [`roadmap.md`](./roadmap.md) (same file).

---

## What this project is

**Operbase** is a multi-tenant business operations platform. The first vertical is bakeries.
It lets owners track inventory (ingredients + packaging), manage production batches, and record sales.

---

## Monorepo structure

```
operbase/
├── apps/
│   └── web/                  # Next.js 15 frontend (App Router)
└── packages/
    └── supabase/
        ├── migrations/        # SQL migrations — run these on Supabase
        └── seed/              # Seed data (units lookup table)
```

---

## Tech stack

| Layer       | Tool                                      |
|-------------|-------------------------------------------|
| Framework   | Next.js 15 (App Router), React 19         |
| Styling     | Tailwind CSS v4, shadcn/ui                |
| Database    | Supabase (Postgres + Auth + RLS)          |
| Auth        | Supabase Auth (email/password, Google OAuth on login) |
| Charts      | Recharts (BarChart on dashboard home + sales page; PieChart removed) |
| Testing     | Vitest + Testing Library + jsdom          |
| Language    | TypeScript (strict mode)                  |
| Deploy      | Vercel-friendly (default Next.js; set `NEXT_PUBLIC_SITE_URL` in prod for OG) |

**Typecheck:** `next.config.mjs` may set `typescript.ignoreBuildErrors: true` — run `npx tsc --noEmit` in `apps/web` for a strict check until that is removed.

---

## Environment variables

Copy `apps/web/.env.example` → `apps/web/.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://hplsdhcxlvmwvvskxwfe.supabase.co   # dev
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SITE_URL=https://your-domain.com   # optional; improves OG URLs (else VERCEL_URL is used on Vercel)
```

Supabase projects:
- **Dev**: `hplsdhcxlvmwvvskxwfe`
- **Prod**: `usbdxwddcxqwhhwxkbwq`

---

## Getting started

```bash
# 1. Install deps
cd apps/web && npm install

# 2. Run migrations on Supabase (via dashboard SQL editor or CLI), in order:
#    packages/supabase/migrations/20260403000000_init_schema.sql
#    packages/supabase/migrations/20260403000001_create_business_rpc.sql
#    packages/supabase/migrations/20260403000002_bakery_business_logic.sql
#    packages/supabase/migrations/20260403000003_future_ready_scaffold.sql
#    packages/supabase/migrations/20260403000004_analytics_and_modules.sql
#    packages/supabase/migrations/20260403000005_perf_concurrency.sql
#    packages/supabase/migrations/20260403000006_dashboard_rpcs.sql
#    packages/supabase/migrations/20260403000007_rls_optimization.sql
#    packages/supabase/migrations/20260403000008_fix_metrics_and_batch_items.sql
#    packages/supabase/migrations/20260403000009_sales_product_name_dashboard_period.sql
#    packages/supabase/migrations/20260403000010_weighted_average_cost.sql
#    packages/supabase/migrations/20260403000011_per_product_costing.sql
#    packages/supabase/migrations/20260403000012_purchase_lots_fifo.sql
#    packages/supabase/migrations/20260403000013_production_giveaway_units.sql
#    packages/supabase/seed/units.sql

# 3. Start dev server
npm run dev

# 4. Run tests
npm test
```

---

## Database schema (key tables)

All business data is scoped to `business_id`. RLS policies enforce tenant isolation.

```
auth.users              ← Supabase-managed auth

businesses              ← one row per tenant
  id, name, logo_url, brand_color, subdomain, business_type

user_businesses         ← links auth.users → businesses
  user_id, business_id, role (owner | manager | staff)

units                   ← shared lookup, seeded (gram, kg, litre, piece…)
  id, name, type (weight | volume | count)

items                   ← ingredients + packaging
  id, business_id, name, type, unit_id (legacy = usage), purchase_unit_id, usage_unit_id,
  conversion_ratio (usage per 1 purchase), low_stock_threshold,
  cost_per_unit (latest price paid per purchase unit — updated on restock),
  avg_cost_per_usage_unit (rolling WAC in usage units — maintained by trg_stock_entry_wac trigger,
    used by create_production_batch for COGS; never edit directly)

stock_entries           ← append-only ledger (quantity always in usage units)
  id, business_id, item_id, quantity, cost_per_unit (per usage at entry), source
  (purchase | batch_deduction | batch_reversal | manual), reference_id?, note

stock_levels            ← VIEW: SUM(quantity) per item
  item_id, business_id, quantity_on_hand

products                ← finished goods (MVP: one row per name per business; created via ensure_product RPC)
  id, business_id, name, unit_id?, sale_price, is_active

batches                 ← production runs
  id, business_id, product_id (required for new RPC-created batches), units_produced, units_remaining,
  cost_of_goods?, notes, produced_at
  Create with inventory: RPC create_production_batch (calls for p_product_id); delete with restore: delete_production_batch

batch_items             ← ingredients consumed per batch
  id, batch_id, item_id, quantity, unit_id, cost

customers               ← per-business customer records
  id, business_id, name, phone, email

sales                   ← revenue records
  id, business_id, customer_id?, batch_id?, product_id?, product_name (denormalized label),
  units_sold, unit_price, revenue (computed), cogs, gross_profit (computed), sold_at
  COGS: average unit cost from batches with the same product_id only (see docs/costing-model.md)

subscriptions           ← recurring orders
  id, business_id, customer_id, product_id, quantity, frequency, next_due, unit_price

roles                   ← Phase 2: named roles per business (owner, manager, staff, custom)
  id, business_id, name, description

permissions             ← Phase 2: atomic permission keys (e.g. 'stock:read', 'batch:create')
  id, key, label, module

role_permissions        ← Phase 2: many-to-many join
  role_id, permission_id

invites                 ← Phase 2: pre-signup invites with a token link
  id, business_id, email, role, token, accepted_at, expires_at, invited_by

business_settings       ← Phase 3: per-business locale config
  business_id, timezone, currency, locale

payment_methods         ← Phase 4: global catalogue (cash, bank_transfer, invoice, mobile_money)
  id, key, label, is_manual, is_active

business_payment_settings ← Phase 4: which methods a business has enabled + gateway config (jsonb)
  id, business_id, payment_method_id, is_enabled, config

platform_admins         ← Phase 5: users with platform-wide access
  user_id

feature_flags           ← Phase 5: catalogue (multi_user, ecommerce, payment_gateway, etc.)
  id, key, label, default_on

business_feature_flags  ← Phase 5: per-business flag overrides
  business_id, flag_id, enabled

analytics_events        ← Append-only event log (Phase 1+)
  id, business_id, user_id, action_type, metadata (jsonb), created_at

business_modules        ← Which modules a business has enabled
  id, business_id, module_key ('inventory'|'production'|'sales'|...), is_enabled, enabled_at
  Auto-seeded with Phase 1 modules on business creation (trigger)
```

### Phase scaffold status

| Phase | What | Status |
|-------|------|--------|
| 1 | Single business, owner only, stock + batches + sales | **Done** — core CRUD, Server Component architecture (RSC pages + client islands), server-side RPC aggregation (`dashboard_metrics`, `low_stock_alerts`), RLS optimized to `user_in_business()` EXISTS pattern, trigram text-search indexes, `SELECT FOR UPDATE` concurrency fix, event tracking, getting-started helper |
| 2 | Multi-user RBAC (roles, permissions, invites) | Schema ready, no UI |
| 3 | Multi-business SaaS (custom_domain, plan, business_settings) | Schema ready, no UI |
| 4 | Payments (manual methods seeded, gateway config slot ready) | Schema ready, no UI |
| 5 | Platform admin, feature flags | Schema ready, no UI |

---

## Auth + routing flow

```
/                → **Marketing landing** (logged out). Logged-in users → /dashboard (middleware).
/login           → Sign-in (email/password + Google) → /dashboard
/signup          → Sign-up (strong password rules) → verify if required → /login
/auth/callback   → Supabase OAuth/email link callback
/onboarding      → Multi-step form after first login (creates business via RPC); partial progress saved in localStorage (per user + device)
/dashboard/*     → Protected; middleware checks session (+ `user_businesses` on first dashboard hit, then `ob_onboarded` cookie for ~1h; layout also verifies session + business)
```

Middleware (`apps/web/middleware.ts`) enforces:
1. **Session + `/`** → redirect to `/dashboard` (skip marketing home)
2. No session + `/dashboard/*` → redirect to `/login`
3. No session + `/onboarding` → redirect to `/login`
4. Session + `/login` or `/signup` → redirect to `/dashboard`
5. Session + `/dashboard/*` without a business row → redirect to `/onboarding`
6. **Onboarding cookie (`ob_onboarded`):** After the first successful `user_businesses` check for a dashboard request, middleware sets a short-lived **httpOnly** cookie (1h TTL) so later navigations skip that DB round-trip. **`POST /api/auth/logout`** expires it in the same response as server `signOut` (client JS cannot clear httpOnly cookies). Middleware also clears it when there is no session (safety net). **Local dev:** `secure` is false so the cookie works on `http://localhost`.

Keep middleware limited to auth and onboarding — no extra product logic here.

### Onboarding draft persistence

Partial onboarding progress is **saved in the browser** so a signed-in user without a business can close the tab and return on the **same device** without losing the wizard step and form fields.

| Topic | Detail |
|-------|--------|
| **Module** | `lib/onboarding/draft-storage.ts` — `loadOnboardingDraft`, `saveOnboardingDraft`, `clearOnboardingDraft`, `onboardingDraftStorageKey` |
| **Storage key** | `operbase.onboardingDraft.v1:<userId>` in `localStorage` (scoped per Supabase user id) |
| **UI wiring** | `app/onboarding/page.tsx` — hydrate after `getUser()`; debounced save (~400ms) when `step` or `form` changes; `toast.message` when a draft is restored |
| **Clear draft** | After successful `create_business_with_owner`; on RPC error path *user already has a business*; **Start over and clear saved progress**; drafts **older than 90 days** are removed on load |
| **Race guard** | A ref stops persisting after a successful finish so a late debounced write cannot recreate a draft |
| **Not cross-device** | No Supabase table — for cross-browser resume you would add an `onboarding_drafts` (or similar) table with RLS |

**Tests:** `__tests__/lib/onboarding/draft-storage.test.ts`. Onboarding page tests install `__tests__/helpers/memory-local-storage.ts` because some Node/Vitest environments expose an incomplete `localStorage` (e.g. missing `clear`).

---

## Marketing site

The marketing site is a multi-page setup with proper SaaS positioning. Operbase is the product; bakery is a use-case/vertical.

| Route | Purpose |
|-------|---------|
| `/` | Homepage: hero, problem, product pillars, steps, testimonials, CTA |
| `/product` | Module deep-dives (Stock, Production, Sales, Dashboard) + feature grid |
| `/solutions` | Bakery as first vertical + coming-soon verticals |
| `/pricing` | Two-tier pricing (Free / Pro) + FAQ |
| `/login` | Sign in |
| `/signup` | Sign up |

**Source files:** `components/landing/` for the homepage, standalone `app/product/page.tsx`, `app/solutions/page.tsx`, `app/pricing/page.tsx` for the inner pages. All pages use `components/shared/navbar.tsx` and `components/shared/footer.tsx`.

**Content:** All copy lives in `components/landing/content.ts`. Testimonials are **placeholder copy** — not real customers. Footer legal links are **placeholders** (no Privacy/Terms routes yet).

**Animations:** `components/landing/animate-in.tsx` — IntersectionObserver-based, fires only when element enters viewport. Immediately shows elements for `prefers-reduced-motion` users. CSS class `landing-animate` defined in `globals.css`.

**Layout metadata:** Root `app/layout.tsx` sets `metadataBase` from `NEXT_PUBLIC_SITE_URL` or `https://${VERCEL_URL}` for correct absolute URLs on Vercel.

**Gotcha (historical):** `motion-reduce:animate-none` cancels CSS animation but not `opacity: 0`, making elements permanently invisible for reduced-motion users. Reason for using `AnimateIn` component instead.

---

## Key files in `apps/web/`

```
lib/
  supabase/client.ts      createClient() → browser Supabase client
  supabase/server.ts      createClient() → SSR Supabase client (uses next/headers)
  supabase/public-env.ts  getSupabasePublicConfig() → { url, anonKey }
                          Falls back to localhost placeholder at build time
  auth.ts                 signIn / signUp / signOut / signInWithGoogle — signOut calls `POST /api/auth/logout` then `supabase.auth.signOut()`
  format-currency.ts      formatCurrency(amount, currency) → locale-aware string via Intl.NumberFormat
                          ALWAYS use this for price display — never raw .toFixed(2)
  services/events.ts      trackEvent(actionType, businessId, metadata?) — event tracking
                          Fails silently. Fire AFTER a successful write, never before.
  bakery/cost.ts          costPerUsageUnit, usageQuantityFromPurchaseQty, batch/sale COGS helpers
  bakery/simple-presets.ts COMMON_INGREDIENTS, COMMON_BAKES, COMMON_BATCH_SIZES, etc.
  onboarding/draft-storage.ts  localStorage helpers for onboarding wizard draft (see "Onboarding draft persistence")
  utils.ts                cn() — Tailwind class merge utility
  dashboard/
    cached-dashboard-context.ts  getCachedDashboardContext() — React `cache()`'d auth + primary
                          business for one request (layout + RSC pages share one DB hit)
    load-home-data.ts     loadDashboardHomeData() — calls dashboard_metrics + low_stock_alerts RPCs
    stock-data.ts         loadStockInitial() + StockItemRow type
    production-data.ts    loadProductionInitial() + BatchRow type
    sales-data.ts         loadSalesInitial() + SaleRow type

hooks/
  use-business.ts       useBusiness(initialBusiness?) — used by `BusinessProvider`. With SSR
                        `initialBusiness` from the dashboard layout, skips the initial client
                        `user_businesses` fetch. `refetch()` still re-queries.

providers/
  business-provider.tsx BusinessProvider + useBusinessContext() for dashboard client islands.

middleware.ts           Auth guard + onboarding redirect + optional `ob_onboarded` cookie (see above)

app/
  layout.tsx            Root layout (fonts, Toaster, metadataBase, title template)
  page.tsx              Marketing landing (server metadata + `<LandingPage />` client)
  login/page.tsx        Login (email/password, Google, password visibility)
  signup/page.tsx       Signup form (email + password only; business set up in onboarding)
  auth/callback/        Supabase auth callback handler
  onboarding/page.tsx   3-step: business name → branding → business type (+ local draft persistence)
  dashboard/
    layout.tsx          Server: session + business guard; BusinessProvider + DashboardLayout shell
    page.tsx            Server: load RPC metrics → `<DashboardHomeClient />` (charts, telemetry)
    dashboard-home-client.tsx  Client: Recharts + `trackEvent`
    stock/page.tsx      Server: `loadStockInitial` → `<StockPageClient />`
    stock/stock-page-client.tsx
    production/page.tsx Server: `loadProductionInitial` → `<ProductionPageClient />`
    production/production-page-client.tsx
    sales/page.tsx      Server: `loadSalesInitial` → `<SalesPageClient />`
    sales/sales-page-client.tsx

components/
  dashboard-layout.tsx  Sidebar + mobile header; useBusinessContext(); injects CSS vars
                        (--brand, …) on [data-dashboard]. Does **not** wrap BusinessProvider
                        (the dashboard `layout.tsx` does).
  landing/              Marketing home: `landing-page.tsx`, `landing-nav.tsx`, `landing-hero.tsx`,
                        `landing-sections.tsx`, `landing-footer.tsx`, `animate-in.tsx`, `content.ts`
  shared/               `navbar.tsx`, `footer.tsx`, `container.tsx`, `section.tsx`
                        Used by /product, /solutions, /pricing marketing pages
  ui/                   shadcn/ui components (do not edit — regenerate via CLI)
```

---

## Patterns and conventions

### Getting `businessId` in a page
```ts
// Dashboard client islands: use context (populated from SSR in layout)
const { businessId, loading } = useBusinessContext()
if (!businessId) return null
```

In **Server Components** under `app/dashboard/`, call `getCachedDashboardContext()` from
`@/lib/dashboard/cached-dashboard-context` (same request as the layout — deduped via `cache()`).

Outside the dashboard tree, `useBusiness(null)` in a provider-less test or legacy shell still works;
prefer `useBusinessContext` whenever `BusinessProvider` wraps the tree.

### Querying Supabase in client components
```ts
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
const { data, error } = await supabase.from('items').select('*').eq('business_id', businessId)
```

### Querying in server components / route handlers
```ts
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

### Adding stock (restock)
Always insert into `stock_entries`, never update `items` directly.
Stock levels are read from the `stock_levels` view.

```ts
await supabase.from('stock_entries').insert({
  business_id: businessId,
  item_id: item.id,
  quantity: qty,           // positive = restock, negative = deduction
  cost_per_unit: item.cost_per_unit,
  source: 'purchase',
  note: 'Manual restock',
})
```

### Toast notifications
Use `sonner`:
```ts
import { toast } from 'sonner'
toast.success('Done!')
toast.error('Something went wrong')
```

### Error handling pattern
```ts
try {
  const { error } = await supabase.from('...').insert({...})
  if (error) throw error
  toast.success('Saved!')
} catch (error: any) {
  toast.error(error.message ?? 'Failed')
}
```

---

## Testing

Run all tests: `npm test` (in `apps/web/`)
Run with coverage: `npm run test:coverage`
Run in watch mode: `npm run test:watch`

Tests live in `apps/web/__tests__/`. Mirror the source structure:
```
__tests__/
  helpers/memory-local-storage.ts  in-memory Storage for tests that need localStorage
  lib/utils.test.ts
  lib/auth.test.ts
  lib/onboarding/draft-storage.test.ts
  hooks/use-business.test.ts
  app/login.test.tsx
  app/signup.test.tsx
  app/onboarding.test.tsx
  app/dashboard/dashboard-home.test.tsx
  app/dashboard/stock.test.tsx
  app/dashboard/production.test.tsx
  app/dashboard/sales.test.tsx
```

Mock Supabase using the shared helper:
```ts
import { mockSupabaseClient, resetSupabaseMocks } from '@/__tests__/helpers/supabase-mock'
```

---

## Postgres helper functions (SECURITY DEFINER)

| Function | Purpose |
|----------|---------|
| `create_business_with_owner(p_name, p_subdomain, p_logo_url, p_brand_color, p_business_type, p_currency DEFAULT 'USD')` | Atomically inserts `businesses`, `user_businesses`, and `business_settings` (with currency) in one transaction. 6th param is optional. Call from onboarding. |
| `ensure_product(p_business_id, p_name)` | Returns `products.id`, inserting a row for trimmed `p_name` if needed (max 200 chars). Used before batch create and when saving sales. |
| `create_production_batch(p_business_id, p_units_produced, p_produced_at, p_display_name, p_extra_notes, p_lines, p_product_id)` | Validates stock, deducts `stock_entries`, writes `batch_items`, sets `batches.product_id` and `cost_of_goods`. |
| `delete_production_batch(p_batch_id)` | Reverses `stock_entries` for each ingredient line, then deletes the batch. |
| `monthly_spend_by_item(p_business_id, p_year, p_month)` | Returns per-item purchase spend for a given month (used on dashboard chart). |
| `dashboard_metrics(p_business_id)` | Single-call revenue, COGS, gross profit, sales/batch/item counts (dashboard home). |
| `low_stock_alerts(p_business_id, p_limit)` | Returns low/out-of-stock items for alerts (dashboard home). |
| `is_platform_admin()` | Returns true if `auth.uid()` is in `platform_admins`. Used in RLS policies. |
| `user_in_business(p_business_id)` | Returns true if `auth.uid()` belongs to the given business. Used in RLS (see migration `00007`). |

Never bypass these RPCs by writing directly to `batches` or `batch_items` — they are the integrity layer.

---

## Event Tracking

`lib/services/events.ts` exports `trackEvent(actionType, businessId, metadata?)`.

**Tracked events:**

| Event | Where fired |
|-------|-------------|
| `dashboard_viewed` | `app/dashboard/dashboard-home-client.tsx` — when `businessId` is set |
| `item_created` | `app/dashboard/stock/stock-page-client.tsx` — after item insert |
| `stock_updated` | `app/dashboard/stock/stock-page-client.tsx` — after restock |
| `batch_created` | `app/dashboard/production/production-page-client.tsx` — after RPC |
| `sale_recorded` | `app/dashboard/sales/sales-page-client.tsx` — after insert |

**Rules:**
- `trackEvent` must NEVER throw or block the main operation (silent catch)
- Stored in `analytics_events` table — append-only, no updates
- Fire AFTER the main action succeeds, never before

---

## Business Modules

`business_modules` table tracks which product modules are enabled per business.
Default Phase 1 modules: `inventory`, `production`, `sales`.
A trigger on `businesses` seeds these automatically on business creation.

**Do not gate existing features behind module checks** until Phase 2 business-type switching UI is built.

---

## Architecture note — why not microservices?

This is **not a monolith**. It's Next.js (frontend) + Supabase (separate backend service). The RPC layer is already a stable API boundary: callable from any client, typed, and enforced in Postgres.

Microservices would add distributed transaction complexity for no benefit at this scale. When the time comes to expose a public REST/GraphQL API, add Next.js `/api/v1/` route handlers that call the same Supabase RPCs — no schema or business logic changes needed.

---

## What NOT to do

- Don't edit files under `components/ui/` manually — use `npx shadcn@latest add <component>`
- Don't query `user_businesses` directly in dashboard UI — use `useBusinessContext()` (or server `getCachedDashboardContext()` in RSCs)
- Don't write to `stock_entries` with `update` — always `insert` (append-only ledger)
- Don't write directly to `batches` or `batch_items` — use the RPCs
- Don't add business logic to `middleware.ts` beyond auth + onboarding checks
- Don't use `any` types unless absolutely necessary
- Don't start Phase 2–5 UI until Phase 1 is stable and has paying users

---

## Feature Implementation Protocol

> **Every feature must go through all four stages before it is considered done.**
> This is not optional. A feature that passes tests but fails the real-user check is not done.

---

### Stage 1 — Build

- Implement the feature following codebase patterns
- Write a DB migration if schema changes are needed
- Add or update tests (`npm test` must pass with zero failures)
- Keep language simple in all labels, messages, and headings (see Language Rules below)

---

### Stage 2 — First-Time User Simulation

Mentally walk through the feature as a **non-technical small business owner** (think: bakery owner, not developer). Ask yourself at each step:

| Check | Question |
|-------|----------|
| **Labels** | Would I understand this without reading a manual? |
| **Steps** | Is there anything that feels like "work"? |
| **Errors** | Do error messages tell me *exactly* what to fix? |
| **Empty states** | Does the empty state tell me what to do next? |
| **Jargon** | Is any word here something my accountant would say, not me? |

Fix everything that fails this check before moving on.

**Common patterns to watch for:**
- Words like "variant", "SKU", "COGS", "batch", "units" — replace with "type", "product", "what it cost", "run", "items"
- Buttons that say "Submit" or "Save" with no context — use "Save product", "Log this sale", "Record what I made"
- Tables where columns need explanation — every heading must be obvious on its own
- Flows with more than 3 steps for a daily action — break it up or combine steps

---

### Stage 3 — Real-Day Business Scenario

Simulate a real business day end-to-end. For a bakery this looks like:

1. **Morning:** I baked 8 banana breads → Production → log 8 units
2. **Afternoon:** I sold 5 → Sales → log 5 at ₦500 each
3. **End of day:** I gave 1 away → mark as given out in the batch
4. **Leftover:** 2 remain → shows in Production "Left" column and dashboard

Ask:
- Does the system match the order I actually do things?
- Is any step buried or hard to find?
- Does the profit/loss shown match what I earned in my head?
- Is the language on the results screen something I would say myself?

Fix anything that breaks the mental model of a real business day.

---

### Stage 4 — AI Query Test *(when AI assistant is live)*

Test these three natural-language queries against the data:

1. "How much flour did we use this week?"
2. "Did I make profit today?"
3. "What is left in my pantry?"

Each query must:
- Return a short, direct answer (one or two sentences)
- Not show raw numbers without context (say "You made ₦2,400 profit" not "gross_profit: 2400")
- Fail gracefully if data is missing ("You haven't logged any sales today yet")

The AI must **never** modify data or act without a user confirmation step.

---

## Product System Rules

These rules are enforced in code and must be maintained in every change:

```
Product → Variant → Add-on
```

| Rule | Detail |
|------|--------|
| **No duplicate names** | `ensure_product` RPC enforces unique `(business_id, name)`. Never bypass it. |
| **Variants belong to a product** | `product_variants.product_id` is `NOT NULL` — no orphan variants |
| **Cost lives at variant level** | `product_variants.cost_per_unit` is the source of truth for manual cost. Falls back to batch WAC if null. |
| **Sales reference variant_id** | When a variant is selected at sale time, store `variant_id` on the sale row. Never store just a name string. |
| **Add-ons are optional** | Add-ons never block a sale from being logged. They are informational. |
| **Products are per-business** | All queries must filter by `business_id`. RLS enforces this, but never omit the filter client-side. |

---

## Brand & Language Rules

### Theme

All interactive elements inside `[data-dashboard]` pick up the business brand color automatically via `DashboardBrandCss`. Keep using `bg-amber-600 hover:bg-amber-700` in className — the CSS override in `DashboardBrandCss` maps these to `var(--brand)` and `var(--brand-dark)` at runtime.

When adding new color classes that should follow the brand, add them to `components/dashboard-brand-css.tsx`.

Never use hardcoded hex colors (`#d97706`, `#f59e0b`) anywhere in dashboard components.

### Language (use these, not those)

| ❌ Technical term | ✅ Human phrase |
|-------------------|-----------------|
| Revenue | Money in |
| Profit / Gross profit | You kept |
| Cost of goods | What it cost |
| Units | Items |
| Variant | Type |
| SKU | — (never use) |
| Batch | Run |
| Stock entry | — (never exposed) |
| Inventory | Stock / what you have |
| Low stock threshold | Alert me when at or below |
| Conversion ratio | How many per pack |
| WAC / weighted average | usual cost |
| Submit | Save [thing] |
| Record | Log |
| Create | Add |

Apply consistently in:
- Table headings and column names
- Form labels
- Button text
- Toast messages
- Empty states
- Error messages

### Tone

- Write in second person ("You kept", "What you made")
- Direct and short — no filler words
- Never blame the user in error messages
- Toast success = "Saved!", "Done." — not "Operation completed successfully"
- Toast error = tell them exactly what to fix in plain language

---

## Getting started (migrations to run in order)

```
packages/supabase/migrations/20260403000000_init_schema.sql
packages/supabase/migrations/20260403000001_create_business_rpc.sql
packages/supabase/migrations/20260403000002_bakery_business_logic.sql
packages/supabase/migrations/20260403000003_future_ready_scaffold.sql
packages/supabase/migrations/20260403000004_analytics_and_modules.sql
packages/supabase/migrations/20260403000005_perf_concurrency.sql
packages/supabase/migrations/20260403000006_dashboard_rpcs.sql
packages/supabase/migrations/20260403000007_rls_optimization.sql
packages/supabase/migrations/20260403000008_fix_metrics_and_batch_items.sql
packages/supabase/migrations/20260403000009_sales_product_name_dashboard_period.sql
packages/supabase/migrations/20260403000010_weighted_average_cost.sql
packages/supabase/migrations/20260403000011_per_product_costing.sql
packages/supabase/migrations/20260403000012_purchase_lots_fifo.sql
packages/supabase/migrations/20260403000013_production_giveaway_units.sql
packages/supabase/migrations/20260403000014_batch_dispositions.sql
packages/supabase/migrations/20260403000015_business_timezone_default.sql
packages/supabase/migrations/20260409000016_product_variants_addons.sql
packages/supabase/migrations/20260409000017_variant_cost_per_unit.sql
packages/supabase/seed/units.sql
```
