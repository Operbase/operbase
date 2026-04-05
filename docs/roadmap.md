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

## 7. Security Foundations

- All data scoped by `business_id`  
- Row-level security (RLS)  
- Role-based access (Phase 2 — schema path ready)  

---

## 8. UX Principles

- Speed over features  
- Minimal input required  
- Mobile-first  
- Clear flows  

---

## 9. Key Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Overbuilding too early | Strict phase execution — see scope guard at top |
| Complex UX | Continuous user testing |
| Rigid data model | Modular API design |
| Tax law complexity per country | Config-driven rules table, not hard-coded logic; start with user's declared country |
| Multi-currency financial consolidation | All internal values stored in business's base currency; FX conversion is a reporting layer |
| Billing alienating early users | Grandfather Phase 1 core features; gate only advanced features |

---

## 10. Guiding Principle

**Build for one real user → Validate → Expand → Platformize**

---

## 11. Event Tracking (Analytics)

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
