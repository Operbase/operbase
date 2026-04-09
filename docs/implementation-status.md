# Operbase — Implementation Status

This file tracks what has been **built and verified**, what is **incomplete**, and what has not been started.
For the full product vision and phase plan, see `roadmap.md`.

---

## DONE — Core features (Phase 1)

| Feature | Notes |
|---------|-------|
| Stock — ingredients | Add, edit, restock. Units, low-stock alerts. |
| Stock — packaging | Same system as ingredients, separate tab. |
| Weekly pantry view | "This week" tab: start of week, used, added, on hand now. |
| Production runs (simple mode) | Product + quantity + giveaway count + date. Ingredient section hidden by default. |
| Production runs (detailed mode) | "Track what you used" expands ingredient lines + cost-as-you-type preview. |
| Dispose units | `dispose_batch_units` RPC: deducts from an existing batch with `kind` = `given_out \| not_sold \| spoiled`. Used by "I gave away" Quick Log tab. |
| Sales logging | From a production run (links real stock) or quick sale (average cost). |
| Per-product profit (COGS) | Each product uses its own production batches only — no blended average. |
| FIFO stock deduction | Each restock creates a `purchase_lot` with frozen `cost_per_usage_unit`. Production consumes lots `ORDER BY purchased_at ASC` — oldest stock first. If lot exhausted mid-line, continues to next lot. `production_lot_allocations` tracks each slice for correct batch-delete reversal. |
| Product catalog | 3-step wizard: name + sale price → variants → add-ons. Sale price, avg production cost, profit per unit, and margin % all shown per product and per variant. |
| Product variants | `product_variants` table; `variant_id` on `batches` and `sales`. Variant chips appear in Quick Log and production modal. |
| Product add-ons | `product_addons` table; shown in product catalog for user reference. |
| Per-product / per-variant margin | Products page shows: avg cost/unit, profit/unit, margin pill (green ≥50%, amber 25–49%, red <25%). Computed from real batch runs only. |
| Insights page | Period selector (this month / last month / last 3 months / all time). KPI cards (revenue, production cost, gross profit, margin). Smart insight cards (danger/warning/good/action/info). Per-product breakdown with expandable variant rows. Inline "what to do" prompts when data is missing. |
| "What happened today?" inline log | **Cards** on the home page (3 action cards) and a **bar** strip on every other dashboard page. Three flows: I bought, I made, I sold. Multi-step "I made" flow: step 1 = product + qty, step 2 = "did you sell any?" option cards, step 3 = price + qty if yes. Profit feedback with large number + emotional tone. Profit memory in localStorage (`wh_profit_{businessId}`): tracks last/best profit and shows "🔥 Your best sale yet!" or "Better than your last sale." Soft assistant voice (one suggestion per action). |
| Global Quick Log | Floating + FAB. Tabs: **I made**, **I sold**, **I bought**, **I used**, **I gave away**. Pre-fills product from page context events. |
| Quick Log — I made | Creates production batch. Optional "some were sold right away" checkbox to record a sale simultaneously. |
| Quick Log — I sold | Logs a sale with optional batch linkage. |
| Quick Log — I bought | Restocks an ingredient via `add_purchase_lot`. Free unit selector: purchase unit, usage unit, or any other unit. For non-standard units (e.g. crate) shows a conversion field ("how many eggs per crate?") and converts correctly to purchase units before saving. |
| Quick Log — I used | Depletes stock directly via `stock_entries` insert with `source = 'manual_use'`. Optional product/reason field for context. For stock that didn't go into a full production run (samples, testing, etc.). |
| Quick Log — I gave away | Reason picker: Sample/gift, Couldn't sell, Spoiled. Date-based auto-match to closest production run. Calls `dispose_batch_units` directly — no phantom batch created. |
| Tooltips on financial metrics | ⓘ icons on "Avg production cost", "Profit per unit", "Margin" explain the formula. On both Products and Insights pages. |
| Dashboard | Today's profit, items waiting to sell, money in + you kept cards, quick actions. |
| Brand theming | CSS variables (`var(--brand)`) injected at `:root` — works in dialogs too. |
| Rule-based AI assistant | Answers stock/usage/profit/sales questions using keyword scoring. No external API. |
| Multi-tenant auth + RLS | All data scoped to `business_id`. |
| Business onboarding | Name, currency, timezone, logo, brand color. |
| Business timezone | All date calculations (period bounds, calendar dates) respect the business's IANA timezone. |

## DONE — Language and UX improvements

| Before | After |
|--------|-------|
| "batch" | "run" |
| "Revenue" | "Money in" |
| "Profit" / "Gross profit" | "You kept" / "You keep" |
| "Money tied up in unsold items" | "Ingredient cost in unsold items" |
| "Purchase unit" | "How you buy it" |
| "Recipe unit" | "How you measure it in recipes" |
| "Your unit" (table header) | "Unit" |
| "Price per unit" (table header) | "Cost to you" |
| "Conversion must be greater than zero" | Full-sentence explanation |
| "Ask your admin to run the units seed" | Human-friendly message with guidance |
| Empty dashboard: no order-of-operations | Numbered steps: 1. Add stock → 2. Record a run → 3. Log a sale |
| "Do this next" | "Quick actions" |
| "Profit" (sale preview) | "You keep" |
| "See details" (sale preview) | "See cost breakdown" |
| "See details" (sales page daily view) | "See daily breakdown" |

## DONE — Database migrations

| Migration | What it adds |
|-----------|-------------|
| 20260403000000 | Init schema: units, businesses, items, stock_entries, products, batches, sales, customers |
| 20260403000001 | `create_business` RPC |
| 20260403000002 | Bakery business logic: purchase/usage units on items, `create_production_batch`, `record_sale_with_batch` |
| 20260403000003 | Future scaffold: roles, invites, feature flags, modules |
| 20260403000004 | Analytics and modules |
| 20260403000005 | Performance indexes, concurrency hardening |
| 20260403000006 | Dashboard RPCs: spend breakdown, profit summary |
| 20260403000007 | RLS optimization |
| 20260403000008 | Fix batch_items and metrics |
| 20260403000009 | Sales `product_name` denorm, dashboard period queries |
| 20260403000010 | Weighted average cost (`avg_cost_per_usage_unit` on items) |
| 20260403000011 | Per-product COGS, `ensure_product` RPC, `products.UNIQUE(business_id, name)` |
| 20260403000012 | FIFO purchase lots: `purchase_lots`, `production_lot_allocations`, `add_purchase_lot` RPC, updated `create_production_batch`, `delete_production_batch` |
| 20260403000013 | Production giveaway units: `units_given_away`, `units_not_for_sale` on batches |
| 20260403000014 | `dispose_batch_units` RPC: `given_out \| not_sold \| spoiled` deduction from a batch |
| 20260403000015 | Business timezone default in `business_settings` |
| 20260409000016 | Product variants + add-ons: `product_variants`, `product_addons`, `variant_id` on batches + sales |
| 20260409000017 | `cost_per_unit` on `product_variants` |
| 20260409000018 | `sales.product_id NOT NULL` constraint |
| 20260409000019 | `variant_id` wired into `create_production_batch` and `record_sale_with_batch` RPCs |
| 20260409000020 | New count units: crate, tray, box, bottle, jar, tin, sachet, carton, flat |

---

## INCOMPLETE

| Feature | What is missing |
|---------|-----------------|
| Business settings UI | Currency/timezone set at onboarding but no "edit settings" page. |
| Low-stock push/email alerts | Threshold works in UI but no notification is sent. |
| Multi-user roles | Schema scaffolded (`roles`, `permissions`, `invites`). No UI. |
| Purchase waste / damaged-on-arrival | Currently "enter only usable quantity" (Option A). Split waste entry (Option B) is roadmap Phase 2. |

---

## NOT STARTED (mapped to roadmap phases)

| Feature | Phase |
|---------|-------|
| Business settings edit page | Phase 1.5 |
| In-app guided tours + hotspots | Phase 1.5 |
| Multi-user roles + invites | Phase 2 |
| Platform admin UI | Phase 3 |
| Non-bakery business types (generic vertical) | Phase 3.5 |
| Payment gateways (Paystack, Flutterwave) | Phase 4 |
| Invoicing + PDF export | Phase 4 |
| Ecommerce / public ordering pages | Phase 5 |
| Tax engine | Phase 6 |
| MCP server + agent gateway | Phase 7 |
| In-app AI chatbot (beyond current assistant) | Phase 7 |
| Platform billing | Phase 8 |
| Customer acquisition network | Phase 9 |
