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
- AI Insights  

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

**Goal:** Enable transactions  

**Features:**

- Payment methods (manual + gateway-ready)  
- Invoicing  

**Data focus:**

- Payment behavior  
- Revenue patterns  

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

### Phase 6 — Intelligence Layer

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
