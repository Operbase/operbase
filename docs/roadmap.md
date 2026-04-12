# Operbase — Product, Roadmap & Internal API Architecture

---

## For AI assistants (scope guard)

**Prompt (copy for tools):**

Refer to `docs/roadmap.md` for:

- current phase  
- allowed scope  
- API structure  

Do not implement features outside the current phase.

From inside `docs/`, the same file is [`roadmap.md`](./roadmap.md).

---

## 1. Vision

Operbase is a simple business operating system for small businesses to track operations, understand costs, and know real profit with clarity.

It is built for business owners — not just single-location sole traders. An owner might run the same business across five branches, or own a bakery and a restaurant, or operate entirely online. Operbase is designed to grow with them: one login, one platform, whether they have one outlet or many.

The long-term possibility — not a guarantee, but a direction worth building toward — is that Operbase becomes more than a back-office tool. With enough businesses on the platform, Operbase could become the layer that connects them to customers: a network where we help small businesses get found, get orders, and grow. If we reach that point, the data and trust we have built from running their operations puts us in a uniquely credible position to do it.

---

## 2. Product Layers

**Core Product (Now)**

- Stock Management  
- Production Tracking  
- Sales Tracking  
- Profit Calculation  

**Future Feature Layers**

- Ecommerce
- Payment Integrations
- Invoicing + Document Printing
- Globalisation (tax, multi-location, multi-country)
- **AI Assistant (model-agnostic)** — starts with Groq free tier in Phase 1.6; upgrades to Claude Haiku/Sonnet for paid plans in Phase 7; multi-model router keeps provider switching a config change, not a rewrite *(see Phases 1.6 & 7)*
- **Operbase MCP** — a Model Context Protocol server exposing safe, business-scoped tools so **any MCP-capable client** (Cursor, Claude Desktop, custom apps) can query and act on behalf of an authenticated business *(see Phase 7)*
- **Agents** — autonomous or semi-autonomous workflows on top of the same capabilities (often MCP + server-side orchestration) *(see Phase 7)*
- **Mobile (PWA)** — installable progressive web app; mobile-optimised surface focused on quick log, today's profit, and alerts *(see Phase 3.6)*
- Platform Billing
- Customer Acquisition Network *(long-term vision — see Phase 9)*
- **CRM integrations** *(exploratory)* — sync customers/leads with external CRMs when a clear operator use case emerges; not committed *(see “Integrations (exploratory)” below)*

**Solution Layer (Entry Points)**

- Bakery (V1) ✅
- Generic fallback — any business type (Phase 3.5)
- Retail / Services / Restaurant — vertical-specific language + presets on top of generic (Phase 3.5+)

The strategy is not to build a dedicated vertical per business type. The core engine is universal. Verticals are a config map (labels, presets, empty state copy) layered on top — not separate builds.

**Business structures supported (when fully built):**

| Structure | How Operbase handles it |
|-----------|------------------------|
| Single business, single location | Default — one business, no branches |
| Single business, multiple branches (e.g. 5 restaurant locations) | Phase 3.7 — branches under one entity; consolidated + per-branch financials |
| Multiple businesses, same owner (e.g. bakery + restaurant) | Phase 3.8 — owner console; one login, business switcher, cross-business roll-up |
| Virtual (online only) | Phase 3.5 business_mode flag drives UX language; ecommerce storefront is opt-in, not assumed |
| Physical (in-store) | Default mode; ecommerce opt-in if they want an online ordering page |
| Both (store + online orders) | Phase 3.5 + Phase 5; walk-in and online sales tracked in same profit engine |

### Integrations (exploratory)

**CRM (e.g. HubSpot, Zoho, generic webhooks)** — *possible, not planned.* Operbase already has `customers` and sales context; a CRM link might help businesses that live in both tools. **Use cases are not defined yet** — treat this as a discovery item: interview operators, then decide sync direction (one-way export vs. two-way), objects (contacts only vs. deals), and whether it belongs in Phase 4 (financial) or Phase 5 (ecommerce). **Do not build until the use case is explicit.**

---

## 3. Phased Roadmap

### Phase 1 — Bakery OS MVP ✅ (shipped)

**Goal:** Real usage, simplicity  

**Features shipped:**

- Stock (ingredients + packaging) with unit conversion (purchase → usage) and FIFO lot costing
- Common count units: gram, kilogram, pound, cup, litre, piece, dozen, bag, crate, tray, box, and more
- Production runs with optional ingredient tracking and FIFO stock deduction
- Dispose batch units: given away, couldn't sell, spoiled — with reason tracking
- Sales with optional batch linkage and per-product COGS
- Product catalog with variants, add-ons, sale price, avg cost, profit/unit, and margin %
- Insights page: revenue, production cost, gross profit, margin, smart insight cards, per-product breakdown
- Global Quick Log (floating + FAB): I made, I sold, I bought, I used, I gave away
- **"What happened today?" bar + cards**: compact inline quick-log on every dashboard page (bar) and the home page (3 action cards). Three flows: I bought, I made, I sold. Multi-step "I made" flow with an explicit "did you sell any?" screen. Shows real profit feedback with large number + sentiment color. Remembers last/best profit per business in localStorage and surfaces comparison lines ("Your best sale yet!"). Soft assistant voice after every action.
- Dashboard: today's profit, at-risk unsold items, quick actions
- Brand theming, multi-tenant RLS, business timezone support
- Rule-based AI assistant (no external API — keyword intent matching, hardcoded responses)

**Data focus:**

- Cost per unit (ingredient level, FIFO lot-accurate)
- Cost per batch (exact ingredient cost via lot allocations)
- Profit per product and per variant
- Margin % with inline smart insights

**Status:** Fully shipped. Business currency and timezone at onboarding drive all display and calculations.

---

### Phase 1.5 — Guided UX (Onboarding + In-App Tours)

**Goal:** Reduce drop-off for new users. Move beyond the static checklist into layered, progressive guidance that teaches the app without a manual.

**What already exists:**
- `GettingStartedHelper` — a dismissible 3-step card on the dashboard (static checklist). Reopenable via the "?" button in the sidebar.

**What to build:**

| Type | What it is | Priority |
|------|-----------|----------|
| **Onboarding Tour** | Full intro flow shown once after signup — walks the user through the whole app screen by screen, skippable at any point | High |
| **Product Tour** | Step-by-step spotlight tour for a single page (e.g. "here is how production works"), triggered from the "?" button or empty state | High |
| **Tooltips / Coach Marks** | Small popups anchored to a specific button or field, shown once, dismissed on click — for non-obvious actions (e.g. "tap here to track cost") | Medium |
| **Hotspots** | Pulsing highlight circle on a UI element to draw attention — used sparingly for new features or first-use nudges | Medium |

**Design principles:**
- All tours are **skippable and dismissible** at any step — never block the user
- State stored in `localStorage` (per-device) for MVP; migrate to `user_preferences` DB table when multi-device matters
- Tours are **data-driven** (a config array of steps) not hardcoded per page — so adding a new page tour does not require new component logic
- Tours **never fire if the user has already completed the relevant action** (e.g. no stock tour if they already have items)
- Hotspots and tooltips are **versioned** — each tip has an ID so we can introduce new tips for new features without re-showing old ones

**Implementation approach:**
- Build a single `TourProvider` context + `useTour()` hook
- A `TourSpotlight` overlay component handles the step-by-step pointer + backdrop + navigation
- `Tooltip` and `Hotspot` components are standalone wrappers that read dismissal state from localStorage by tip ID
- No external tour library needed — the surface area is small and we want full control over visual style to match brand color

**Triggers:**
- Onboarding Tour: fires once after business is created (check `localStorage.getItem('ob_tour_done')`)
- Product Tour: triggered by "?" button on any page, or from the `GettingStartedHelper` step CTA
- Tooltips / Hotspots: attached inline to specific elements, fire once per tip ID

**Data we want to track:**
- Tour started, tour completed, tour skipped (step number where skipped)
- Tooltip dismissed
- Helps identify which steps lose users and which features need better discovery

**Status:** Not started. `GettingStartedHelper` is the current placeholder. Replace or extend it as part of this phase.

**Assistant upgrade (no API key required):**
The existing `business-assistant.tsx` component matches keywords and returns hardcoded responses — it does not query any real data. A high-value, zero-cost upgrade in this phase is wiring it to real Supabase RPCs (`dashboard_metrics`, `low_stock_alerts`, per-product COGS) so it returns actual numbers. No external API needed — just data plumbing. This sets the foundation for Phase 1.6.

---

### Phase 1.6 — AI Foundation (Model-Agnostic Assistant)

**Goal:** Introduce a real LLM-powered assistant without locking into a single provider or API cost structure. Start free, upgrade as revenue allows.

**The problem it solves:**

The rule-based assistant hits a ceiling fast — it cannot reason, generalise, or answer unexpected questions. But jumping straight to a paid Claude API integration before the app has paying users creates an unsustainable cost dependency. The solution is a **provider-agnostic AI layer** that starts on a free tier and can be swapped or upgraded per plan tier without rewriting the assistant logic.

**Architecture: Multi-model abstraction**

Use the **Vercel AI SDK** (`ai` package) as the model-agnostic interface. It supports Groq, Anthropic, OpenAI, and others behind a single `streamText` / `generateText` API. Swapping providers is a one-line config change — the assistant code does not know or care which model it is talking to.

```
User query
    ↓
Model Router (selects provider + model based on plan tier / task type)
    ↓
Vercel AI SDK (unified interface)
    ↓
Provider: Groq (free) | Anthropic Claude | OpenAI GPT-4 | others
    ↓
Tool calls → Supabase RPCs (dashboard_metrics, low_stock_alerts, etc.)
    ↓
Response streamed back to in-app assistant
```

**Provider tiers (cost-to-capability ladder)**

| Tier | Provider | Model | Cost | Use case |
|------|----------|-------|------|----------|
| **Free** | Groq | `llama-3.3-70b-versatile` or `llama-3.1-8b-instant` | Free (rate-limited) | Default for free plan users — handles most Q&A |
| **Mid** | Groq | `moonshotai/kimi-k1.5-32k` or `deepseek-r1-distill` | Very cheap | Slightly richer reasoning, still low cost |
| **Premium** | Anthropic | `claude-haiku-4-5` | Paid — low cost | Fast, capable, great for structured tasks |
| **Pro** | Anthropic | `claude-sonnet-4-6` | Paid — mid cost | Full reasoning, long context, agent tasks |

The router selects the tier based on:
- Business plan (`businesses.plan` column — already exists)
- Task complexity hint (simple Q&A vs. multi-step reasoning)
- Remaining free quota (fall back gracefully if rate-limited)

**What the assistant can do (Phase 1.6 scope)**

- Answer questions about real business data: "What was my profit this week?", "Which product has the best margin?", "Am I running low on anything?"
- Explain financial metrics in plain language ("What does COGS mean for my bakery?")
- Suggest actions ("You have 3 unsold batches — consider logging a giveaway or sale")
- Streamed responses for perceived speed

**What it does NOT do yet (Phase 7)**

- Mutate data (log a sale, create a batch, restock an item) — that is Phase 7 agent territory
- Run background or scheduled tasks
- Operate outside the in-app chat surface

**Self-funding model**

Free plan users → Groq free tier → £0 AI cost  
Paid plan users → Claude Haiku / Sonnet → API cost covered by subscription revenue  
This means the AI feature funds itself: only users who pay for it trigger a cost.

**Implementation notes**

- Install `ai`, `@ai-sdk/groq`, `@ai-sdk/anthropic` packages
- Build a `lib/assistant/model-router.ts` that selects provider + model from `businesses.plan`
- Build a Next.js `/api/assistant` route handler (streaming) — replaces the current keyword logic in `business-assistant.tsx`
- Tool definitions map to existing Supabase RPCs — no new DB functions needed
- Rate limit the free tier assistant server-side (e.g. 20 queries / day for free plan)
- Never expose API keys client-side — all provider calls stay in the API route handler

**Data to track**

- Assistant queries per business per day (for rate limiting + billing signal)
- Model used per query (understand real cost distribution)
- Query resolution rate (did the user get a useful answer or ask again?)

**Status:** Not started. Depends on Phase 1.5 data-wiring of the assistant. Groq free tier can be integrated with minimal infrastructure. Provider router pattern must be in place before Phase 7 adds mutating agent tools.

---

### Phase 2 — Business Expansion (Single Business)

**Goal:** Increase usability within one business  

**Features:**

- Multi-user support  
- Role-based access (basic)  
- Improved reporting
- **Purchase waste / damaged-on-arrival tracking** — when goods arrive partially damaged (e.g. 2 eggs broken in a crate of 30), record quantity received vs quantity usable, with the damaged units written off as a separate waste/shrinkage expense rather than absorbed into the remaining stock cost. Currently the app uses the simpler "enter only what arrived usable" approach (Option A), which is correct for most small businesses. Option B (split waste entry) is the upgrade path here.



**Data focus:**

- User activity  
- Role usage  

**Status:** Schema scaffolded (`roles`, `permissions`, `role_permissions`, `invites`). No UI.

---

### Phase 3 — Multi-Tenant Platform

**Goal:** Support multiple businesses  

**Features:**

- Business onboarding ✅  
- Branding (logo, color) ✅  
- Business isolation ✅ (RLS)  

**Data focus:**

- Business-level metrics  
- Feature usage per business  

**Status:** Core tenant model live. Platform admin + feature-flag schema ready; UI later.

---

### Phase 3.5 — Vertical Abstraction + Business Mode Layer

**Goal:** Support any business type without building a separate vertical for each one — and distinguish how a business operates (physical, virtual, or both)

**The problem it solves:**

The bakery vertical is built on a generic data model — items, production runs, sales, profit. What makes it feel like a "bakery app" is just language and presets. Building a dedicated Retail vertical, then a Services vertical, then a Restaurant vertical is not scalable. The right move is to make the core configurable and ship a generic fallback that works for everyone else.

**Approach:**

- `business_type` already exists on `businesses` and is set at onboarding
- Add a config map per `business_type` that drives UI language:
  - Bakery → "ingredients", "batches", "baking"
  - Retail → "products", "restocks", "orders"
  - Services → "materials", "jobs", "services"
  - Generic (default) → "items", "production runs", "sales"
- Preset chips (common ingredients, common bakes) become vertical-specific addons — present for bakery, absent or different for others
- Enable Retail + Services in the onboarding business type selector (currently disabled)
- Any unrecognised `business_type` falls through to the generic config — no code change needed to support a new type at basic level

**Business mode (physical vs virtual)**

Not every business has a physical store. A baker who only takes orders on WhatsApp and delivers is a virtual business. Someone with a shop counter is physical. Many are both. Either way, they might or might not want an Operbase storefront — that is a separate choice.

Add `business_mode: 'physical' | 'virtual' | 'both'` at onboarding (one extra question: "Do you sell in a physical location, online only, or both?"). This drives:

- **UX language only** — virtual businesses see "order received" where physical businesses see "walk-in sale"; both see both. It tells the app how to frame things, not what features to enable.
- Ecommerce (Phase 5) is **always opt-in** regardless of mode. A virtual seller might already have their channel (Instagram, WhatsApp) and use Operbase purely for back-office — no storefront needed. A physical store owner might want an online ordering page too. The choice is theirs, not assumed.
- This is a config flag, not a schema fork — the same tables serve all modes

**What does NOT change:**

- DB schema — tables are already vertical-agnostic
- Core profit engine — revenue, cogs, gross profit are universal
- RLS and multi-tenancy — no impact

**Data focus:**

- Feature usage by business type (which vertical drives most engagement)
- Activation rate by type (does a retailer complete the same onboarding steps as a bakery?)
- Split of physical vs virtual vs both — informs ecommerce rollout priority

**Status:** Not started. `business_type` column and onboarding selector exist; non-bakery types are disabled. Estimated effort: 2–3 days once Phase 3 multi-user work is stable.

---

### Phase 3.6 — Mobile (PWA)

**Goal:** Give business owners a lightweight, installable mobile experience without a separate native codebase.

**Why PWA, not React Native (at this stage)**

The app is already Next.js + Tailwind — the responsive foundation exists. A PWA adds a `manifest.json` and service worker on top of the existing web app, making it installable to the home screen on iOS and Android, with no App Store submission, no second codebase, and no additional infrastructure. For small business owners (the Operbase user), home screen install is more than sufficient at this stage. A dedicated React Native app can be evaluated when usage data justifies the investment.

**What the mobile experience prioritises**

The mobile app is intentionally lighter than the web app. Owners are in a kitchen, at a market, or on the go — they are not doing financial analysis on their phone. The focus is:

| Surface | Include on mobile | Rationale |
|---------|-------------------|-----------|
| Today's profit (dashboard) | ✅ | First thing they want to see |
| Global Quick Log (FAB) | ✅ | Core mobile action — I made / I sold / I bought |
| Low stock alerts | ✅ | Actionable, time-sensitive |
| At-risk unsold batches | ✅ | Quick decision needed |
| Insights / full analytics | ⬜ | Desktop/tablet — not needed on the go |
| Products catalog | ⬜ | Setup task — done on desktop |
| Full stock management | ⬜ | Setup task — done on desktop |
| Settings | ⬜ | Desktop only |

The Quick Log FAB is already the most mobile-native pattern in the app — Phase 3.6 ensures it is optimised for touch (larger tap targets, swipe-friendly sheets, no hover states).

**What to build**

- `public/manifest.json` — app name, icons, theme color (uses business brand color), display: `standalone`
- Service worker via `next-pwa` or manual registration — cache shell + static assets for offline load
- `<meta name="apple-mobile-web-app-capable">` and icon tags for iOS home screen
- Mobile-specific layout adjustments: safe area insets, bottom nav bar (replaces sidebar on small screens), touch-optimised quick log sheet
- Offline fallback page — shown if the user opens the app with no connection
- Push notification groundwork — browser Push API for low-stock and unsold batch alerts (connects to Phase 1 thresholds already in the DB)

**Design principles**

- **One codebase** — all mobile adaptations are responsive CSS + conditional rendering, not a separate app
- **No feature parity required** — the mobile surface is a deliberate subset; do not port every desktop feature
- **Brand color on install** — the installed PWA icon and splash screen should reflect the business's brand color
- **Bottom navigation on mobile** — Today / Log / Alerts (3 tabs max); sidebar stays for tablet/desktop

**Upgrade path**

If mobile usage grows significantly and users need features the PWA cannot deliver (camera access for receipt scanning, native notifications at scale, App Store discoverability), evaluate React Native with Expo at that point. The Supabase backend and API layer will be identical — only the UI layer changes.

**Status:** Not started. Depends on Phase 3 (multi-tenant, stable auth) being solid first. Estimated effort: 3–5 days for PWA baseline + mobile layout polish.

---

### Phase 3.7 — Multi-Branch Businesses

**Goal:** Let a single business entity operate across multiple branches — with consolidated financials and per-branch intelligence

**The problem it solves:**

A restaurant owner with 5 locations, or a bakery with a main shop and two market stalls, should not have to run five separate Operbase accounts and mentally add the numbers together. They should see one business, five branches — with the ability to drill down into any one.

**Two structural patterns (both must be supported):**

| Pattern | What it means | When to use |
|---------|---------------|-------------|
| **Branches under one entity** | A single `business_id` with multiple branch records. All stock, production, sales are tagged to a branch. Financials roll up to the entity AND show per-branch. | Same legal entity, same owner, different physical locations. |
| **Separate businesses, same owner** | Each location is its own `business_id` (handled by Phase 3.8 multi-business owner view). The owner console consolidates across them. | Different legal entities, different branding, or the owner wants them treated independently. |

Most small businesses with "branches" will use the first pattern. The second pattern is covered by Phase 3.8.

**Data model changes:**

- Add `branches` table: `id, business_id, name, address, timezone, is_active`
- All transactional tables (`batches`, `sales`, `stock_entries`, `purchase_lots`) get `branch_id` (nullable — NULL means "main / only branch")
- RLS stays on `business_id` — branches are a sub-scope within a business
- When `branch_id` is NULL, it falls through to "entity level" — backwards compatible, no migration needed for existing single-branch businesses

**What branch consolidation gives you:**

- **Entity view (default):** Total revenue, total cost, total profit across all branches for any period
- **Per-branch view:** Same KPIs filtered to one branch — click any branch to drill in
- **Comparative view:** Side-by-side: which branch made the most money this week? Which has the highest waste rate? Which is running low on stock?
- **Branch intelligence (AI Phase 7):** Proactive signals — "Branch B's margin is 15 points lower than Branch A on the same product. Here is why and what to do."

**Low-performing branch detection:**

The app should surface, without being asked:
- Branch profit vs. entity average (is this branch dragging you down?)
- Branch waste rate vs. other branches
- Branch stock turnover (is one branch over-ordering?)
- Products that sell well at Branch A but not at Branch B — make-more signal

These are rule-based in Phase 3.7 (like the existing insight cards). The AI upgrade in Phase 7 adds narrative and recommendations.

**Onboarding flow for branch setup:**

- At business creation: "Do you operate from one location or multiple?" → Single or Multi
- Multi: add branch names upfront (can add more later in Settings)
- Each branch gets a short code (e.g. "MAIN", "IKEJA", "LEKKI") used in the quick log and production forms

**Status:** Not started. Depends on Phase 3 (multi-tenant) being solid. DB schema must add `branches` table and `branch_id` FK on transactional tables before any UI work starts. Migration must be backwards-compatible (NULL branch_id = single branch entity).

---

### Phase 3.8 — Multi-Business Owner Console

**Goal:** Let one person manage multiple businesses — same or different verticals, same or different industries — from a single login with a unified owner-level view

**The problem it solves:**

A person might run a bakery and a restaurant. Or they might own the same bakery franchise in two cities under two different business names. Or one person might be an accountant or advisor managing Operbase accounts on behalf of several small businesses. In all cases, logging in and out to switch businesses is friction. What they need is:

1. A switcher — fast way to jump between businesses (like switching GitHub orgs)
2. An owner console — a view above any single business: see all businesses at once, spot which is underperforming, manage access

**How this works today:** Already partially true — `user_businesses` is a join table, meaning one user can belong to multiple businesses. What doesn't exist is a UI above the business dashboard that presents all of them.

**What to build:**

| Feature | Description |
|---------|-------------|
| **Business switcher** | Dropdown in the sidebar/top bar. Shows all businesses the user belongs to. One click to switch context — no re-login. |
| **Owner console (home screen before business is selected)** | If a user owns 2+ businesses, the post-login landing is an owner console: all businesses as cards with today's profit, status (active, low stock, unsold items). Click a card to enter that business. |
| **Cross-business roll-up** (optional, paid tier) | See consolidated revenue + profit across all owned businesses for a period. Not the default view — an explicit "all businesses" toggle. |
| **Same-vertical duplication** | If you open a second bakery, "start from a template" — pre-fill the product catalog and stock items from your first business. Saves setup time. |
| **Different-vertical businesses** | Fully independent — no shared data, no shared catalog. The vertical abstraction (Phase 3.5) handles the language correctly per business. |

**Design principles:**

- Owning multiple businesses does not merge their data — each business stays fully isolated (`business_id` RLS is inviolable)
- The owner console is a read-only summary surface — it does not push data between businesses
- A user can be an owner (full access) of one business and a staff member (limited access) of another — roles are per `user_businesses` row, not global
- Free plan: up to 1 business. Starter: up to 3. Pro: unlimited. (Phase 8 billing enforces this.)

**Status:** Not started. `user_businesses` join table already supports the data model. The missing piece is the owner console UI and the switcher UX. Depends on Phase 3 auth being stable.

---

**Goal:** Enable transactions and document generation  

**Features:**

- Payment methods — businesses configure how they accept payment (cash, bank transfer, POS, gateway)
- Payment gateway integration — connect to Paystack, Flutterwave, or other gateways per business; each requires extra credentials stored securely per business
- Invoicing — generate, send, and track invoices per customer/sale  
- Document printing — any generated document (invoice, batch report, sales summary) printable as PDF  
- Billing engine — charge businesses based on plan tier and feature access (see Phase 8)  

**Payment gateway integration model:**

Two connection modes per business:

**Mode 1 — Self-serve (business has existing gateway account)**
Business pastes in their own API keys. Operbase stores them encrypted and handles all gateway communication on their behalf.

| Gateway | Data needed |
|---------|-------------|
| Paystack | Secret key, public key, webhook secret |
| Flutterwave | Secret key, public key, encryption key, webhook secret |
| Manual / cash | No credentials — just a label and instructions |
| Bank transfer | Account name, account number, bank name |

**Mode 2 — Operbase-managed (we set it up for them)**
Business does not have a gateway account. Operbase provisions one on their behalf using Paystack's or Flutterwave's sub-account / platform API. The business completes a KYC flow (name, bank account, BVN or equivalent) inside Operbase — we handle the gateway relationship and they receive payouts to their bank account.

This model positions Operbase as a payment facilitator and enables a transaction fee revenue stream (take a small % of each payment processed through Operbase-managed gateways). Requires:
- KYC data collection and storage (regulated — handle carefully, do not store raw BVN)
- Sub-account creation via gateway platform API
- Payout scheduling and reconciliation
- Compliance: CBN regulations (Nigeria), relevant local rules per market

**Design principles:**

- Credentials are never exposed client-side — stored server-side only, referenced by a gateway connection ID
- A business can have multiple active payment methods (e.g. cash + Paystack) — customer chooses at checkout
- Gateway connection status (active, pending, disconnected) is surfaced in settings UI
- Webhook handling is per-gateway — each has its own endpoint and signature verification
- Payment gateway features are ecommerce-facing (Phase 5) but the connection and credential setup lives here in Phase 4
- Operbase-managed mode is the higher-value path long term — it removes friction for small business owners who don't want to manage gateway accounts themselves

**Data focus:**

- Payment method usage per business  
- Gateway transaction success/failure rates  
- Invoice status + aging  

**Status:** Schema scaffolded (`payment_methods`, `business_payment_settings`). No UI. Gateway credential storage schema needs to be designed before implementation.

---

### Phase 5 — Ecommerce Layer

**Goal:** Any business on Operbase that wants to sell online gets a storefront automatically — no separate build, no technical setup

**The core idea:**

Every business on Operbase already has a product catalog with names, variants, add-ons, and sale prices (Phase 1). That is everything needed to generate a public ordering page. The ecommerce layer is not a separate feature — it is the product catalog made public-facing, with a URL and a checkout.

**Ecommerce setup flow:**

When a business owner turns on ecommerce, they go through a short setup:
1. **Storefront details** — confirm business name, slug, and cover image (pre-filled from onboarding)
2. **Payment method** — choose how customers pay: bank transfer, cash on delivery, or connect a gateway (Paystack / Flutterwave). This is where they configure payment for the first time if they haven't already, or select from already-connected gateways (Phase 4). A business can offer multiple methods and the customer picks at checkout.
3. **Fulfilment** — pickup at store, delivery to address, or both (branch picker appears here if they have branches)
4. **Go live** — storefront is live at `operbase.store/{business-slug}` or a custom domain

**Auto-built storefronts:**

- When a business enables ecommerce, their storefront is live instantly after the short setup above
- The storefront is generated from the existing `products` + `product_variants` + `product_addons` tables — no manual rebuild
- Brand color, logo, and business name from onboarding flow directly into the storefront — it looks like their brand, not a generic marketplace
- If they update a product name or price in Operbase, the storefront updates automatically
- Ecommerce is always opt-in — business mode does not determine this. A virtual seller may already use Instagram or WhatsApp as their channel and only need Operbase for back-office. A physical store owner may want an online ordering page. Either can enable it; neither has it forced on them.

**What the storefront includes:**

| Feature | Notes |
|---------|-------|
| Product listings | From `products` — name, price, photo (Phase 5 adds product photo upload) |
| Variants + add-ons | From `product_variants` + `product_addons` — customer selects at checkout |
| Order placement | Customer adds to cart, enters name/contact, places order |
| Payment | Connects to the business's configured payment method (Phase 4) — Paystack, Flutterwave, bank transfer, or cash-on-delivery |
| Order confirmation | Auto-send to customer (WhatsApp or email — TBD) |
| Order tracking | Customer can check status with their order ID |

**How orders flow back into operations:**

An order placed on the storefront is not just a sales record — it creates a demand signal inside Operbase:

- New order → appears in a "pending orders" view on the Sales page
- Business owner fulfils the order → marks it as ready/delivered
- On fulfil: links to a production batch (if items are made fresh per order) or deducts from existing `units_remaining`
- Revenue and COGS flow into the same profit engine as walk-in sales — no separate P&L

**Branch + ecommerce (fulfilment config):**

If a business has branches AND has enabled ecommerce, the owner configures how orders are fulfilled. This is a settings choice, not automatic:

| Fulfilment option | What happens |
|-------------------|--------------|
| **Pickup at store** | Customer selects a branch as pickup point at checkout. Branch list comes from Phase 3.7 branch records. |
| **Delivery to address** | Customer enters a delivery address. No branch selection needed. |
| **Both** | Customer chooses pickup or delivery. If pickup, they then pick a branch. |

A business without branches simply doesn't show the branch picker — fulfilment is just pickup (single location) or delivery. No branch concept needed at checkout unless the owner has set up branches.

**Design principles:**

- The storefront is not a separate product — it is a view layer on top of data that already exists
- Every existing Operbase business can opt in to ecommerce without any migration or data entry
- The storefront is mobile-first — most orders will come from phones
- Custom domain support (CNAME) is a paid-tier feature

**Data focus:**

- Storefront conversion rate (views → orders)
- Order source (walk-in vs. online) — already distinguishable by `batch_id` presence and `source` flag on sales
- Repeat customer rate from online orders

**Status:** Not started. Product catalog (Phase 1) is the foundation. Payment gateway integration (Phase 4) must come first. Ecommerce is always opt-in via a single toggle in Settings — business mode has no bearing on the default.

---

### Phase 4.5 — Reporting & Exports

**Goal:** Give business owners the ability to pull structured, downloadable reports from their Operbase data — for accountability, decision-making, and tax/compliance filing

**Why this is a distinct phase**

The Insights page (Phase 1) already gives visual summaries. Reporting is different: it produces a structured document — a PDF, CSV, or spreadsheet — that can be shared with an accountant, filed with a tax authority, shown to a bank, or used for end-of-month reconciliation. The data already exists; reporting is about packaging and exporting it correctly.

**Two layers of reporting:**

**1. Operational reports** — running the business, accountability

| Report | What it covers |
|--------|---------------|
| **Sales report** | All sales for a period: product, quantity, unit price, revenue, COGS, profit per sale. Subtotals per product and per period. |
| **Production report** | All runs for a period: product, units made, units sold, units wasted/given away, cost per run. |
| **Stock movement report** | Every stock entry: item, quantity in/out, source (purchase, production, manual use), running balance. |
| **Ingredient spend report** | Cost of every ingredient purchased in a period. Good for supplier negotiations and budget planning. |
| **Profit & Loss summary** | Revenue, COGS, gross profit, waste cost — for a period. The business's P&L in plain language. |
| **Branch comparison report** | (Requires Phase 3.7) Side-by-side: revenue, profit, waste per branch for a period. |

**2. Compliance reports** — tax filing and external accountability

| Report | What it covers |
|--------|---------------|
| **VAT / sales tax report** | Tax collected per transaction for a period, formatted to the business's country requirements. Depends on Phase 6 tax engine for accurate calculation — a basic version (list of sales with tax line) can ship earlier. |
| **Income summary (accountant-ready)** | Total revenue, total costs, net profit for a period — formatted for handoff to an accountant or bookkeeper. |
| **Inventory valuation** | Current stock on hand × cost per unit = total inventory value. Needed for balance sheet / asset reporting. |

**Export formats:**

- **PDF** — for sharing, printing, filing. Clean layout with business name, logo, period, and page numbers.
- **CSV** — for importing into Excel, Google Sheets, or accounting software (QuickBooks, Wave, Xero).
- Both formats generated server-side (no client-side PDF hacks) — jsPDF or Puppeteer for PDF, simple CSV string for spreadsheet.

**Billing:**

- Basic exports (CSV of sales/production for current month) — **free**
- Full PDF reports with branding + all report types — **one-off unlock** or **Starter+ subscription** (validate which)
- Tax compliance reports — **Pro+ subscription** (tied to Phase 6 tax engine, which is a paid feature)
- Accountant access (share a read-only report link with a third party) — **Starter+**

**Design principles:**

- Reports are generated on demand, not stored — a user requests a report, the server queries the DB and returns the file. No report scheduling in this phase (that's Phase 7 agents).
- Date ranges are always in the business's timezone — never UTC surprises on a tax report.
- Reports are labelled with the business name and report period on every page — professional output that can be handed to a third party without embarrassment.
- For multi-branch businesses (Phase 3.7): every report can be generated per-branch or consolidated across the entity.

**Status:** Not started. The underlying data all exists. Phase 4 (invoicing + PDF infrastructure) shares the PDF generation concern — build that capability once and use it for both invoices and reports.

---

### Phase 6 — Globalisation Layer

**Goal:** Make Operbase work correctly regardless of country of operation  

**Features:**

- Country of operation set per business (already have `timezone`, `currency`, `locale` in `business_settings`)  
- Tax engine — calculate tax per transaction based on business country + business type (VAT, GST, sales tax, etc.)  
- Tax filing support — generate tax-period summaries formatted to local filing requirements  
- Multi-country businesses — branches (Phase 3.7) may operate in different countries with different currencies and tax rules; Phase 6 adds the currency conversion and tax layer on top of the existing branch model  
- Localised number/date/currency formatting per business locale  
- Globalization-aware invoicing — invoice layout, tax line display, and legal fields vary by country  

**Design principles:**

- Tax is always additive, never baked into core price fields — all existing `revenue`, `cogs`, `gross_profit` columns stay tax-exclusive; tax is a separate layer on top  
- Country + business-type matrix drives which tax rules apply (e.g. a bakery in Nigeria uses FIRS VAT 7.5%; a bakery in the UK uses HMRC VAT 20% with potential zero-rating on certain baked goods)  
- No hard-coded country logic in the app — tax rules live in a configurable table, not code  

**Data focus:**

- Tax collected per period  
- Cross-location revenue consolidation  
- Compliance filing history  

**Status:** Not started. Currency at onboarding is the first step (Phase 1 ✅). Full tax engine is Phase 6.

---

### Phase 7 — Intelligence, MCP, Agents & Full AI Upgrade

**Goal:** Make Operbase operable by humans *and* by AI systems — MCP surface, autonomous agents, and an upgrade of the Phase 1.6 assistant to full mutating / agentic capability. This is also where the multi-model router introduced in Phase 1.6 is extended to support more powerful models as premium plan features.

**Relationship to Phase 1.6**

Phase 1.6 introduced the AI foundation: Vercel AI SDK, the model router, Groq free tier, and read-only tool calls to Supabase RPCs. Phase 7 builds directly on top of that layer — it does not replace it. The upgrade path is:

| Phase 1.6 (foundation) | Phase 7 (full capability) |
|------------------------|---------------------------|
| Read-only tool calls (dashboard metrics, stock alerts) | Mutating tool calls (log sale, create batch, restock item) |
| In-app chat only | MCP surface (external clients: Cursor, Claude Desktop, etc.) |
| Groq free tier for free plan | Claude Sonnet / Pro models for paid tiers |
| Single-turn Q&A | Multi-step agents, scheduled background tasks |
| Manual query | Proactive triggers (low stock → auto-notify + suggest restock) |

**Why MCP first**

- One well-designed **Operbase MCP server** (tools scoped by `business_id` + auth) lets **any** MCP host attach: IDEs, desktop assistants, mobile experiments, partner integrations.
- **Agents** (multi-step automation, scheduled jobs, “record this sale from voice note”) should call the **same** underlying contracts as MCP — avoid duplicating business logic in prompt-only paths.
- **In-app chatbot** (already live from Phase 1.6) gets upgraded to use the same tool backend as MCP — not a separate shadow API.

**Features (ordered roughly by dependency)**

| Track | What | Notes |
|--------|------|--------|
| **Mutating tools** | Extend the Phase 1.6 tool layer with write operations: log sale, create batch, restock item, dispose units | Behind explicit human confirmation UI — never silent mutations |
| **MCP server** | Expose the same tools (read + mutating) as an MCP server with OAuth / API key auth | Read-only tools ship first; mutating tools behind confirmation patterns |
| **Model router upgrade** | Route Pro plan users to `claude-sonnet-4-6`; add task-type routing (simple Q&A → cheap model; multi-step agent → capable model) | Builds on Phase 1.6 router — same interface, new tier entries |
| **Agents** | Orchestrated flows: weekly profit summary, low-stock digest, “close the day” checklist | Requires reliable tool contracts + audit logging |
| **Background tasks** | Scheduled agent runs (daily summary email, weekly margin report) | Requires server-side agent loop, not just a chat endpoint |
| **Insights narratives** | AI-generated profit/cost narratives, anomaly detection, forward-looking suggestions | Consumes existing analytics RPCs + event data from `analytics_events` |

**Data focus**

- Historical trends and predictive patterns
- Tool invocation logs (which tools, which business, success/failure) — for safety and billing later
- Model usage per plan tier — validates cost assumptions for Phase 8 pricing

**Status:** Not started. **Scope guard:** do not ship MCP/agents/mutating tools until Phase 1–3 foundations are stable and auth + tenant boundaries are non-negotiable in the tool layer. Phase 1.6 must be live and validated first.

---

### Phase 8 — Platform Billing

**Goal:** Sustainable revenue model that scales with how much value a business gets from Operbase — not a paywall on the basics

**Core principle: free should be genuinely useful**

The free tier must cover everything a small business needs to track their day-to-day operations. If someone can run their bakery on the free tier and never feel the ceiling, they will stay, tell others, and upgrade when they grow. Gating core functionality would undermine that.

---

**What is always free (no plan required)**

| Feature | Why free |
|---------|----------|
| Stock management | Core — reason they signed up |
| Production tracking | Core |
| Sales logging | Core |
| Dashboard (today's profit, alerts) | Core |
| Insights (basic) | Core — knowing margin is the point |
| Basic CSV export (current month sales/production) | Low-friction data access — keeps trust |
| 1 business | Base unit of the product |
| 1 branch / location | Default for single-location businesses |
| Up to 3 staff accounts | Enough for a small team without multi-user overhead |
| AI assistant (rate-limited) | Free tier uses Groq — zero API cost to Operbase |

---

**Subscription features (monthly or yearly billing)**

These cost Operbase ongoing resource — hosting, compute, AI tokens — so they recur with the service.

| Feature | Tier | Notes |
|---------|------|-------|
| Additional businesses (2nd, 3rd…) | Starter+ | Each business = ongoing storage + compute |
| Multi-branch (more than 1 branch) | Starter+ | Each branch = ongoing query + storage cost |
| More staff accounts (beyond 3) | Starter+ | Per-seat or per-tier depending on validation |
| AI assistant — higher quota + smarter model | Starter → Pro | Groq (free) → Claude Haiku → Sonnet; API cost covered by subscription |
| Advanced insights (cross-period, branch comparison) | Starter+ | Heavier DB queries ongoing |
| Ecommerce storefront | Starter+ | Public URL hosting, order handling, ongoing |
| Tax engine (Phase 6) | Pro+ | Country-specific rule maintenance, ongoing compliance |
| Ecommerce on multiple branches | Pro+ | Each branch storefront = separate hosting + order pipeline |

**Yearly billing discount:** Offer ~2 months free on annual plans. Businesses that pay yearly are sticky — they've committed to the tool for the year.

---

**One-off payments (unlock once, not a recurring charge)**

These are discrete unlocks with low ongoing cost — there's no reason to charge every month for them.

| Feature | One-off charge | Notes |
|---------|---------------|-------|
| Custom domain (CNAME on storefront) | One-off setup fee | DNS config is a one-time action; no ongoing cost to Operbase |
| PDF reports (full branded reports — P&L, stock movement, etc.) | One-off unlock or Starter+ | Validate preference; generating PDFs is cheap once infra exists |
| PDF / invoice generation | One-off unlock | Once enabled, the feature is theirs — generating PDFs is cheap |
| Assisted onboarding | One-off service fee | Hands-on setup help from the Operbase team — not automated |
| “Start from template” (clone a business catalog) | One-off | Useful for franchises opening a 2nd location |

---

**Take-rate (no upfront charge — % on transactions)**

Operbase earns when the business earns. Aligned incentives.

| Mechanism | Rate | Applies when |
|-----------|------|-------------|
| Ecommerce orders via Operbase storefront | Small % per order | Business processes payments through Operbase-managed gateway (Phase 4 Mode 2) |
| Customer acquisition referrals (Phase 9) | Success fee per referred customer | Only on customers demonstrably sourced by Operbase network |

Take-rate only applies when Operbase-managed gateways are used. A business using their own Paystack/Flutterwave keys (self-serve mode) pays no take rate — only their subscription if applicable.

---

**Plan shape (illustrative — validate before locking)**

| Plan | What you get | Billing |
|------|-------------|---------|
| **Free** | 1 business, 1 branch, 3 staff, core operations, rate-limited AI | Free |
| **Starter** | Up to 3 businesses, up to 3 branches per business, more staff, ecommerce, AI upgrade | Monthly or yearly |
| **Pro** | Unlimited businesses + branches, full AI (Claude Sonnet), advanced insights, tax engine | Monthly or yearly |
| **Enterprise** | Custom limits, dedicated support, API access, custom domain, assisted onboarding | Yearly + one-off setup |

---

**Schema:** `businesses.plan` column and `feature_flags`/`business_feature_flags` tables are already schema-ready. One-off unlocks are stored as permanent flags on `business_feature_flags` — not a recurring check.

**Status:** Not started. Validate the plan shape with real operators before locking pricing. The take-rate model (Phase 4 Mode 2 gateways) can ship independently of subscription billing — it requires no billing engine, just gateway revenue sharing.

---

### Phase 9 — Customer Acquisition Network *(Long-term vision)*

**Goal:** Help businesses on Operbase find and attract customers — not just manage the ones they already have

This is exploratory, not committed. It only makes sense if we have a critical mass of businesses and enough trust built from being inside their operations. The idea is that Operbase, having run the back office for hundreds of small businesses, is in a position to bridge them to the customers who want what they make.

**Possible directions:**

- **Discovery layer** — a lightweight public-facing surface (directory, search, or embed) where consumers can find local businesses powered by Operbase (e.g. bakeries near me that sell sourdough)
- **Lead routing** — when a consumer expresses interest, route it to the right business based on location, capacity (we know their stock levels), and product match
- **AI-powered matching** — use operational data (what they produce, how often, at what cost) to surface the right businesses for the right demand; suggest to businesses when to produce more based on demand patterns
- **Attribution tracking** — every customer we help a business acquire is tracked separately from their existing walk-in customers; we need a clean number for "customers Operbase helped you get" so we can prove value and eventually charge for it
- **Referral mechanics** — businesses on the network can refer each other (e.g. a bakery refers a customer to a packaging supplier also on Operbase)

**What needs to be true first:**

- Ecommerce layer (Phase 5) must exist — public ordering pages are the consumer-facing surface
- Enough businesses on the platform to make discovery meaningful (network effect threshold)
- Customer data model strong enough to distinguish acquisition source (organic vs. Operbase-referred)
- Trust: businesses must believe Operbase routing them customers is genuinely valuable, not a data play

**Data we need to be collecting now (Phase 1+):**

- Sales volume and frequency per business (already tracked)  
- Product types and inventory levels (already tracked)  
- Customer repeat rate — are their existing customers coming back?  
- Geographic data — where is the business, where are their customers?  

**Monetisation hypothesis:** Take a small success fee per Operbase-referred customer who converts, or offer it as a premium plan feature. Either way, it only works if the referral quality is high.

**Status:** Not started. Vision only. Do not build until Phase 5 (ecommerce) is live and validated.

---

## 4. Data Strategy (VERY IMPORTANT)

**What to track from Day 1**

- Stock usage frequency  
- Most used ingredients / items  
- Cost trends  
- Sales frequency  
- Profit margins  

**Why this matters**

- Drives product improvements  
- Enables AI later  
- Identifies most valuable features  

---

## 5. Internal API Architecture (Future-Proof)

### Principles

- Modular  
- Business-scoped (`business_id` everywhere)  
- Decoupled logic  

### Core services (conceptual)

#### 1. Inventory Service

Handles: items, stock entries, unit conversion  

Internal endpoints (names / responsibilities):

- `createItem`  
- `updateItem`  
- `getStockLevels`  
- `calculateUnitCost`  

**Today:** Supabase tables + `stock_levels` view; cost helpers in `lib/bakery/cost.ts`.

---

#### 2. Production Service

Handles: batches, ingredient usage  

Endpoints:

- `createBatch`  
- `addBatchItem`  
- `calculateBatchCost`  

**Today:** `create_production_batch`, `delete_production_batch` RPCs.

---

#### 3. Sales Service

Handles: orders, customers  

Endpoints:

- `createSale`  
- `updatePaymentStatus`  
- `getSalesSummary`  

**Today:** direct `sales` / `customers` access from the app; summaries on dashboard.

---

#### 4. Profit Engine (Core Asset)

Handles: revenue, costs, profit calculation  

Endpoints:

- `calculateProfit`  
- `getProfitSummary`  

**Today:** dashboard aggregates + `monthly_spend_by_item` RPC.

---

#### 5. Insights Service

Handles: analytics, trends, margin intelligence

Endpoints / data functions:

- `loadInsightsData` — period-filtered aggregation of revenue, COGS, profit, margin, waste, by product + variant
- `buildInsightCards` — rule-based insight generation (danger/warning/good/action/info)
- `getPeriodBounds` — converts period enum to UTC bounds respecting business timezone
- `getItemSpendBreakdown` — monthly ingredient spend (existing RPC)

**Status:** Core layer live (`lib/dashboard/insights-data.ts`). Insights page at `/dashboard/insights` ships period selector, KPI cards, smart insight cards, and per-product/variant breakdown. AI-powered narratives (Phase 7) build on top of this foundation.

---

#### 6. MCP & Agent Gateway (Future — Phase 7)

Handles: exposing **tools** (and optionally resources) to MCP hosts and to the in-app chatbot with identical authorization.

Conceptual responsibilities:

- Authenticate the caller (OAuth / API key / session bridge — TBD)  
- Resolve `business_id` and enforce the same constraints as RLS-facing RPCs  
- Map stable tool names to internal services (inventory, production, sales, profit)  
- Audit log for mutating tools  

**Status:** Not started. See Phase 7.

---

## 6. API Evolution Strategy

**Stage 1 (Now)**

- Internal use only  
- Fast iteration (Supabase + Next.js)  

**Stage 2**

- Stabilize structure  
- Clean interfaces  

**Stage 3**

- Expose selected APIs publicly (e.g. Next.js `/api/v1/` calling the same RPCs)  
- **Operbase MCP** (Phase 7) as a parallel surface: same business rules and auth as HTTP APIs, packaged for MCP clients — not a separate logic fork  

**Potential API products**

- Profit Calculation API  
- Inventory + Unit Conversion API  
- **MCP tool bundles** (read-only analytics pack vs. operations pack) — productisation TBD after Phase 7 MVP  

---

## 7. Infrastructure & Hosting Strategy

**Current:** Single Vercel project (`operbase`) on the free tier under the Operbase GitHub org.

**Target architecture (when scaling):**
- Vercel supports **per-project Pro** or **team-wide Pro** — team-wide is the right model for Operbase since all products (main app, marketing, future API) live under one org and share bandwidth, build minutes, and team seats
- One Vercel team (`Operbase`) → multiple projects (`web`, `api`, `marketing`) — each deployed independently but sharing one billing plan
- This mirrors how the Vercel pricing works: you pay per team, not per project

**Migration path:**
1. Now: free tier, single project, public repo
2. First revenue: upgrade to Vercel Pro team — move repo back to private, unlock preview deployments, higher build limits
3. Scale: consider edge functions or dedicated compute for the tax engine (Phase 6) if latency becomes a concern

---

### Technology Change Points — When and Why

The current stack (Next.js + Supabase + Vercel) is the right choice now: low setup cost, fast iteration, no infrastructure to manage. But every layer has a natural point where the trade-offs shift. This section maps those out so the decisions are made deliberately — not in a crisis.

**The key principle:** the application code (Next.js, TypeScript, SQL schema, RLS, RPCs) is almost entirely portable. Technology changes at the infrastructure layer should not require rewriting the product. The choices below are designed with that in mind.

---

#### Supabase — the most likely layer to change

**What it gives now:** Postgres + Auth + RLS + RPCs + Storage, all managed. Zero ops overhead. Generous free tier.

**The lock-in risk:** Supabase Auth uses `auth.uid()` inside the database functions and RLS policies. This is a Supabase-specific extension. If the auth layer changes, those calls need updating across every RPC and policy — that's real work, not just config. Everything else (the SQL schema, the PL/pgSQL functions, the data) is standard Postgres and fully portable.

**When to reconsider:**

| Trigger | Why it matters |
|---------|----------------|
| Monthly Supabase bill exceeds ~15–20% of revenue | At that point, self-hosted Postgres (£30–80/month VPS) is materially cheaper |
| Enterprise customers require data residency in a specific region | Supabase has regions but not unlimited; self-hosted Postgres on a VPS in any country solves this |
| Regulated industry customers (finance, health) require on-premise or dedicated hosting | Shared managed infrastructure won't satisfy their compliance requirements |
| Supabase makes a significant pricing or product change | Less likely — but worth having an exit path ready |

**Migration path when triggered:**

1. **Database only:** Move to a managed Postgres provider (Neon, Railway, or AWS RDS). The schema, migrations, and RPCs all move as-is — standard SQL. Zero application code changes.
2. **Auth only:** Replace Supabase Auth with Auth.js (NextAuth), Clerk, or custom JWT. Requires updating `auth.uid()` references in RPCs and RLS policies — scoped, not a rewrite. ~2–4 days of careful migration work.
3. **Full self-host:** Run Postgres + Supabase OSS (it's open source) on your own VPS. Same API, same `auth.uid()` — the cheapest path at scale, zero code changes. Operbase could run on a £50/month server for thousands of businesses.

**What never changes regardless:** The SQL schema, data model, RLS design, and RPCs are investments that outlast any vendor. They are written to be standard — no Supabase-proprietary types or functions except `auth.uid()`.

---

#### Vercel — changes when traffic becomes predictable and large

**What it gives now:** Zero-config deployment, automatic preview URLs, global CDN, serverless functions. Ideal when traffic is variable and small.

**The cost shift:** Vercel's pricing is per invocation + GB-second for serverless functions. At low traffic this is cheap. At high, predictable traffic (thousands of businesses logging daily), a dedicated server is dramatically cheaper — a £50/month VPS can handle more load than £300/month of Vercel function calls.

**When to reconsider:**

| Trigger | Why |
|---------|-----|
| Vercel hosting bill exceeds ~10% of revenue | A VPS or Railway instance costs a fraction at sustained load |
| API routes (production, sales, insights) are being called heavily and predictably | Predictable load → reserved compute is cheaper than per-invocation |
| Need long-running processes (report generation, scheduled agent tasks, Phase 7) | Vercel functions have a max execution time; long jobs need a persistent server |

**Migration path:** Next.js runs anywhere. `next start` on any Node.js host — Fly.io, Railway, Render, a raw VPS, or a containerised deployment. Static assets go to a CDN. This is a hosting change, not a code change. A week of DevOps work at most.

---

#### Next.js — lowest risk, least likely to change

**Why it stays:** Next.js is owned by Vercel but is open source, widely deployed, and the migration path to any other React framework (Remix, SvelteKit, etc.) is a UI rewrite — never worth doing unless there's a fundamental architectural reason. There isn't one here.

**Only reason to reconsider:** If the product pivots to pure mobile (React Native) and the web app becomes secondary. Even then, the API layer (Next.js route handlers or a separate API) stays — only the frontend changes.

---

#### AI providers — already handled

The multi-model abstraction (Vercel AI SDK, Phase 1.6) means providers can be swapped with a one-line config change. No lock-in by design. See Phase 1.6 and Phase 7.

---

#### Business owner data — how it stays safe through all of this

This is the non-negotiable concern. A business owner's revenue, cost, and profit data is sensitive. It must be safe at rest, in transit, and across any technology migration.

**Now:**
- All data is isolated by `business_id` with Row Level Security — no business can see another's data, even if the app has a bug
- Supabase encrypts data at rest and in transit
- No raw financial data is ever logged, exposed in error messages, or sent to third parties
- RPCs never return data for a `business_id` that doesn't match the authenticated session

**During a migration:**
- Data export must happen before the old infrastructure is decommissioned — never cut over until the new database is verified to have complete, consistent data
- Migrations run in parallel (old system stays live until new is verified) — no data loss window
- Business owners should be able to export their own data at any time (Phase 4.5 reporting + a full JSON export option) — they are never locked in to Operbase either

**At scale / for regulated markets:**
- Offer data residency options when enterprise customers require it (EU data stays in EU, Nigeria data stays in Nigeria) — achievable by choosing hosting region, not a schema change
- Consider offering a "business data export" endpoint from day one — not just for compliance but for trust. A business owner who knows they can leave (and take their data) is more likely to stay.

**The core commitment:** A business owner's operational data belongs to them. Operbase is a custodian, not an owner. Any technology decision that puts that data at risk — whether through vendor lock-in, insecure migration, or opaque storage — is the wrong decision regardless of cost.

---

#### Summary — when each layer changes

| Layer | Change trigger | Migration effort | Risk to data |
|-------|---------------|-----------------|-------------|
| **Supabase DB** | Cost or data residency requirement | Low — standard SQL, portable | Low — same Postgres, same schema |
| **Supabase Auth** | Cost or compliance | Medium — update `auth.uid()` in RPCs and RLS | Low if done carefully, with parallel run |
| **Vercel** | Cost at predictable high traffic | Low — Next.js runs anywhere | None — hosting only |
| **Next.js** | Almost never | High — UI rewrite | None |
| **AI providers** | Already abstracted | Near-zero | None |

---

## 8. Legal & Compliance

This section must be completed **before any paid plan is offered or user data is stored in production at scale.**

### Privacy & Terms

| Item | Detail |
|------|--------|
| **Privacy Policy** | Required by GDPR (EU), NDPR (Nigeria), and most app stores. Must state what data is collected, why, how long it's kept, and user rights. |
| **Terms of Service** | Sets the contract between Operbase and the business owner. Covers acceptable use, liability, payment terms, account termination. |
| **Accept on signup** | Users must actively accept Privacy Policy + Terms before creating an account — checkbox with links, not pre-ticked. Store `accepted_terms_at` timestamp on the user record. |
| **Cookie consent** | Required for GDPR users. Operbase uses Supabase auth cookies (strictly necessary, no consent needed) + any analytics. Show a consent banner for non-essential cookies. |
| **NDPR** (Nigeria Data Protection Regulation) | Applies because the primary market includes Nigeria. Requires a Privacy Policy, lawful basis for processing, and data subject rights (access, deletion). |
| **GDPR** (EU General Data Protection Regulation) | Applies to any EU users. Stricter than NDPR — includes right to erasure ("delete my account + data"), data portability, and DPA requirements if using processors (Supabase, Vercel). |

### Implementation plan

1. Write Privacy Policy and Terms of Service pages (`/privacy`, `/terms`) — linked from footer and signup
2. Add `accepted_terms_at timestamptz` and `accepted_terms_version text` columns to `auth.users` metadata (or a `user_consents` table)
3. Signup form: checkbox "I agree to the Terms of Service and Privacy Policy" — required, not pre-checked
4. Cookie banner: lightweight, stores preference in `localStorage`; only fires for non-essential cookies
5. Account deletion flow: when a user deletes their account, cascade-delete all business data or anonymise it (Supabase `auth.admin.deleteUser` + trigger)
6. Data Processing Agreement (DPA) with Supabase — already available at supabase.com/dpa; sign and store a copy

**Status:** Not started. Footer links (`/privacy`, `/terms`) are placeholders. **Do before launching paid plans.**

---

## 9. Security Foundations

- All data scoped by `business_id`  
- Row-level security (RLS)  
- Role-based access (Phase 2 — schema path ready)  
- DB errors never surfaced to users raw (see `lib/errors.ts` `friendlyError()`)  

---

## 10. UX Principles

- Speed over features  
- Minimal input required  
- Mobile-first  
- Clear flows  

---

## 11. Key Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Overbuilding too early | Strict phase execution — see scope guard at top |
| Complex UX | Continuous user testing |
| Rigid data model | Modular API design |
| Tax law complexity per country | Config-driven rules table, not hard-coded logic; start with user's declared country |
| Multi-currency financial consolidation | All internal values stored in business's base currency; FX conversion is a reporting layer |
| Billing alienating early users | Grandfather Phase 1 core features; gate only advanced features |
| Legal exposure (GDPR/NDPR) | Implement terms, privacy policy, cookie consent, and account deletion before scaling — see Section 8 |
| Hosting cost spike | Vercel team Pro when revenue justifies; one plan covers all projects under the org |
| Customer network becomes a data trust problem | Be transparent from day one that operational data informs matching; never sell raw data; success fee model keeps incentives aligned |
| MCP / agents exfiltrate or corrupt tenant data | Ship read-only tools first; mutating tools behind explicit human confirmation; audit logs; same RLS rules as the app — never bypass `business_id` |
| AI API cost before revenue exists | Multi-model abstraction (Phase 1.6): free plan uses Groq free tier (£0 cost); paid plan subscribers fund Claude API usage via subscription revenue. Rate-limit free tier server-side. Cost scales with paying users, not with total signups. |
| Vendor lock-in to a single AI provider | Vercel AI SDK as the abstraction layer — swapping providers is a config change, not a rewrite. Never call a provider SDK directly from assistant logic. |
| Mobile experience inconsistent across devices | PWA approach (Phase 3.6) reuses existing Next.js codebase; test on iOS Safari and Android Chrome specifically. Bottom nav + safe area insets handle the key edge cases. |

---

## 12. Guiding Principle

**Build for one real user → Validate → Expand → Platformize**

---

## 13. Event Tracking (Analytics)

In a shorter outline without **§7 (Infrastructure)** and **§8 (Legal)**, this section is numbered **§11**.

Track:

- Item Created  
- Stock Updated  
- Batch Created  
- Sale Recorded  
- Dashboard Viewed  

Store:

- `user_id`  
- `business_id`  
- `timestamp`  
- `action_type`  

Purpose:

- Understand user behavior  
- Identify friction points  
- Guide feature improvements  

**Implementation:** `trackEvent` in `apps/web/lib/services/events.ts` → `analytics_events` table. See **Event Tracking** in [`AGENTS.md`](./AGENTS.md) for event names and call sites.
