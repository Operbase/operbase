# Operbase — Product, Roadmap & Internal API Architecture

---

## For AI assistants (scope guard)

Refer to **`roadmap.md`** (this file, under `docs/`) for:

- current phase  
- allowed scope  
- API structure  

**Do not implement features outside the current phase.**

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
- AI Insights  
- Platform Billing  
- Customer Acquisition Network *(long-term vision — see Phase 9)*  

**Solution Layer (Entry Points)**

- Bakery (V1)  
- Retail (Future)  
- Services (Future)  

---

## 3. Phased Roadmap

### Phase 1 — Bakery OS MVP ✅ (current)

**Goal:** Real usage, simplicity  

**Features:**

- Stock (ingredients + packaging)  
- Unit conversion (e.g. paint → cups, purchase → recipe units)  
- Batch production  
- Sales tracking  
- Profit dashboard  

**Data focus:**

- Cost per unit  
- Cost per batch  
- Profit per day / week / month  

**Status:** Shipped in app + DB. Business currency at onboarding drives display.

---

### Phase 2 — Business Expansion (Single Business)

**Goal:** Increase usability within one business  

**Features:**

- Multi-user support  
- Role-based access (basic)  
- Improved reporting  

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

### Phase 4 — Financial Layer

**Goal:** Enable transactions and document generation  

**Features:**

- Payment methods (manual + gateway-ready)  
- Invoicing — generate, send, and track invoices per customer/sale  
- Document printing — any generated document (invoice, batch report, sales summary) printable as PDF  
- Billing engine — charge businesses based on plan tier and feature access (see Phase 7)  

**Data focus:**

- Payment behavior  
- Revenue patterns  
- Invoice status + aging  

**Status:** Schema scaffolded (`payment_methods`, `business_payment_settings`). No UI.

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

### Phase 7 — Intelligence Layer

**Goal:** Smart insights  

**Features:**

- AI recommendations  
- Profit insights  
- Cost optimization  

**Data focus:**

- Historical trends  
- Predictive patterns  

**Status:** Not started.

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
- Billing is per business, not per user seat (at least initially)  

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

#### 5. Insights Service (Future)

Handles: analytics, trends  

Endpoints:

- `getMonthlyInsights`  
- `getItemSpendBreakdown`  

**Status:** Planned; partial spend insight exists via RPC + charts.

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

**Potential API products**

- Profit Calculation API  
- Inventory + Unit Conversion API  

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

---

## 12. Guiding Principle

**Build for one real user → Validate → Expand → Platformize**

---

## 13. Event Tracking (Analytics)

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
