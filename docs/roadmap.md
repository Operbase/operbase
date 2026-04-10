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

### Phase 3.5 — Vertical Abstraction Layer

**Goal:** Support any business type without building a separate vertical for each one

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

**What does NOT change:**

- DB schema — tables are already vertical-agnostic
- Core profit engine — revenue, cogs, gross profit are universal
- RLS and multi-tenancy — no impact

**Data focus:**

- Feature usage by business type (which vertical drives most engagement)
- Activation rate by type (does a retailer complete the same onboarding steps as a bakery?)

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

### Phase 4 — Financial Layer

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

**Goal:** External customer interaction  

**Features:**

- Public ordering pages  
- Order tracking  

**Data focus:**

- Customer behavior  
- Conversion rates  

**Status:** Not started.

---

### Phase 6 — Globalisation Layer

**Goal:** Make Operbase work correctly regardless of country of operation  

**Features:**

- Country of operation set per business (already have `timezone`, `currency`, `locale` in `business_settings`)  
- Tax engine — calculate tax per transaction based on business country + business type (VAT, GST, sales tax, etc.)  
- Tax filing support — generate tax-period summaries formatted to local filing requirements  
- Multi-location / multi-country businesses — a single business account can have multiple operating locations, each with its own country, currency, and tax rules; financial reporting consolidates across locations  
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

**Goal:** Charge businesses based on access to features  

**Features:**

- Plan tiers (Free, Starter, Pro, Enterprise) — already seeded as `businesses.plan` column  
- Feature gating — `business_feature_flags` table (Phase 5 schema) drives which features are unlocked per plan  
- Usage-based limits — e.g. number of users, locations, API calls  
- Self-serve upgrade/downgrade inside the app  
- Payment gateway integration for subscription billing  

**Design principles:**

- Never gate Phase 1 core features (stock, production, sales) for existing users — grandfather them
- Advanced features (multi-location, tax filing, invoice generation, ecommerce) are paid-tier
- **AI assistant is a paid-tier feature** — free plan gets rate-limited Groq access (Phase 1.6); Starter/Pro plans unlock higher quotas and more capable models (Claude Haiku → Sonnet). API costs are covered by subscription revenue — the AI feature is self-funding.
- Billing is per business, not per user seat (at least initially)  

**Fee models — research (not a committed design)**

Several monetisation shapes are on the table; **none is chosen**. Validate with real operators before locking schema or UX:

| Idea | Question to answer |
|------|---------------------|
| **Platform / take rate** | Small % on payments processed through Operbase-managed gateways (already noted in Phase 4) — aligns when we facilitate money movement |
| **Per-user (seat) fee** | Makes sense when Phase 2 multi-user is mature and larger teams drive cost |
| **AI assistant quota tier** | Free plan: limited Groq queries/day. Starter: higher quota + Claude Haiku. Pro: unlimited + Claude Sonnet + agent features. Subscription revenue directly funds API costs — no cross-subsidisation. |
| **Product-combination or bundle fee** | Charge differently when certain *combinations* of modules/features are enabled (e.g. inventory + ecommerce + AI) — needs clear packaging, not ad-hoc SQL |
| **User-defined “fee flow”** | Let a business configure rules like “when products A+B appear on an order, apply fee X” — powerful for franchises/marketplaces but high complexity; might overlap with tax/discount engines (Phase 6) |

**Open concern:** A custom fee-flow builder can become a second product (rules engine, audits, disputes). Prefer **one simple primary model** (e.g. tier + optional take rate) until revenue proves the need for composable fees.

**Status:** Not started. `businesses.plan` column and `feature_flags`/`business_feature_flags` tables are schema-ready.

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
