# Changelog (engineering)

High-level record of behavior changes that affect the product or database. **Newest first.**

---

## 2026-04-09 — Insights page, tooltips, new count units, crate fix

### What changed

- **Insights page** (`/dashboard/insights`): new page with period selector (this month / last month / last 3 months / all time), KPI overview (revenue, production cost, gross profit, margin), smart insight cards (danger/warning/good/action/info with inline CTA links), and per-product breakdown with expandable variant rows. Data layer: `lib/dashboard/insights-data.ts`.
- **Tooltips on financial metrics**: ⓘ icons added to "Avg production cost", "Profit per unit", "Margin" on both the Products and Insights pages. Tooltip text explains the formula in plain English.
- **Migration 20260409000020**: adds `crate`, `tray`, `box`, `bottle`, `jar`, `tin`, `sachet`, `carton`, `flat` to the global `units` table.
- **"I bought" crate fix**: the unit dropdown now shows all units including crate. For units that are neither the purchase unit nor the usage unit, a conversion field appears ("how many eggs in 1 crate?"). The entered qty is multiplied by that factor, then divided by the item's conversion ratio to arrive at purchase units for `add_purchase_lot`.
- **Insights nav entry**: "Insights — Margins & profit" added to the sidebar.

### Why

User needed to buy eggs by the crate and the unit wasn't available. Insights page was the core visibility layer the product was missing — sale price vs production cost vs margin in one place.

---

## 2026-04-09 — Products page rewrite: variants, add-ons, margins

### What changed

- **Products page** now shows: sale price, avg production cost per unit, profit per unit, margin pill, and run count — at both the product level and per-variant level.
- **Product wizard** (step 1) now includes a sale price input. Was previously missing.
- **`ProductVariantRow` and `ProductCatalogRow`** types extended with `avgCostPerUnit` and `runCount`, computed from real batch runs in `products-data.ts`.
- **`MarginPill`** component: green ≥50%, amber 25–49%, red <25%, with trend icons.

### Why

User needed to know, at a glance, whether each product and variant is profitable. Without this, she had no way to see production cost vs sale price without doing mental math.

---

## 2026-04-09 — Product variants and add-ons

### What changed

- **`product_variants`** table: id, product_id, business_id, name, sort_order, cost_per_unit.
- **`product_addons`** table: id, product_id, business_id, name, extra_cost, sort_order.
- **`variant_id`** (nullable) added to `batches` and `sales`.
- **`create_production_batch`** and **`record_sale_with_batch`** RPCs accept optional `p_variant_id`.
- **Product wizard** updated: step 2 = variant chips (add/reorder/delete), step 3 = add-on chips.
- **Quick Log** variant chips appear after product selection on I made, I sold, I gave away tabs.

### Migration

`20260409000016`, `20260409000017`, `20260409000018`, `20260409000019`

---

## 2026-04-09 — "I used" and "I gave away" tabs in Quick Log

### What changed

- **"I used" tab**: new Quick Log tab. Depletes stock directly via `stock_entries` insert (`source = 'manual_use'`). User can optionally tag it to a product. For stock consumed outside of a full production run (samples, testing, wastage not tied to a batch).
- **"I gave away" rework**: no longer creates a phantom batch. Now selects an existing production run (auto-matched by date, user can override) and calls `dispose_batch_units` directly with `kind` = one of: `given_out` (sample/gift), `not_sold` (customer didn't buy, end of day), `spoiled` (expired/damaged). Full reason picker in the UI.

### Why

Creating a fake batch for giveaways polluted the production history and made run counts wrong. The `dispose_batch_units` RPC already existed; the UI needed to use it properly.

---

## 2026-04-03 — "I bought" free unit selector

### What changed

- **"I bought" unit dropdown** replaced the binary "dozens vs. pieces" toggle with a free selector showing: purchase unit, usage unit (if different), and all other units from the DB.
- Selecting the usage unit shows a live conversion hint ("30 pieces = 2.5 dozen stored").
- Selecting any other unit shows a custom conversion field so the user can specify (e.g. "30 eggs per crate").

### Why

The old implementation hard-coded the toggle only when `conversionRatio > 1`, which prevented users who buy in non-standard units from entering stock correctly.

---

## 2026-04-03 — FIFO purchase lots

### What changed

- **`purchase_lots`** table: every `add_purchase_lot` call creates a lot with its own `cost_per_usage_unit` (frozen at purchase time) and `quantity_remaining`.
- **`production_lot_allocations`** table: each production run records exactly which lots it consumed and how much.
- **`create_production_batch`** now consumes lots `ORDER BY purchased_at ASC` (oldest first). If a lot is exhausted, it continues to the next. Manual `purchase_lot_id` on a line overrides auto-FIFO.
- **`delete_production_batch`** restores `quantity_remaining` on all affected lots.
- **Price change scenario**: if flour was ₦0.20/g in Lot 1 (50g left) and ₦0.40/g in Lot 2 (new purchase), a run using 200g will consume 50g @ ₦0.20 + 150g @ ₦0.40 = exact cost ₦70. No averaging of lot prices.

### Migration

`20260403000012_purchase_lots_fifo.sql`

---

## 2026-04-03 — dispose_batch_units RPC

### What changed

- New RPC **`dispose_batch_units(p_batch_id, p_quantity, p_kind)`** deducts from `batches.units_remaining` and increments the right counter (`units_given_away`, `units_not_sold_loss`, or `units_spoiled`) depending on `p_kind`.
- Does **not** create a new batch — it modifies an existing one.

### Migration

`20260403000014_batch_dispositions.sql`

---

## 2026-04-03 — Logout clears `ob_onboarded` immediately

### What changed

- **`POST /api/auth/logout`** revokes the Supabase session (server-side cookie updates) and expires the httpOnly **`ob_onboarded`** cookie in the same response.
- **`signOut()`** in `lib/auth.ts` calls that route first, then the existing browser **`supabase.auth.signOut()`** so client state stays in sync.

### Why

`ob_onboarded` is httpOnly, so client-only sign-out could not remove it until the next middleware pass, which briefly made the user look "onboarded" without a session.

---

## 2026-04-03 — Per-product COGS for sales

### What changed

- **Sales COGS** is no longer a single weighted average across **all** batches in the business.
- It uses **only batches that share the same `product_id`** as the sale (the finished good).
- **`create_production_batch`** now requires **`p_product_id`** and sets **`batches.product_id`**.
- New RPC **`ensure_product(p_business_id, p_name)`** returns a `products` row id, creating the row if needed (trimmed name, max 200 characters enforced in SQL).

### Why

Different products (e.g. croissants vs bread) have different ingredient costs and batch economics. A global average mixed their margins and made profit misleading.

### Migration

`20260403000011_per_product_costing.sql`

---

*(Add older entries below when you make other foundational changes.)*
