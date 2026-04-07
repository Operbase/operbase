# Costing model (MVP)

This document describes how Operbase derives **cost of goods sold (COGS)** and how that ties to production and sales. The database migrations in `packages/supabase/migrations/` are authoritative; this file is for humans and future tooling.

## Goals

- **Per finished good**, not one blended average across the whole bakery.
- **Simple UX**: owners still type what they baked and what they sold. The app resolves that to a stable **`products` row** behind the scenes.
- **Trustworthy profit**: `sales.cogs` should reflect the average production cost **for that product only**.

## Entities

| Piece | Role |
|-------|------|
| **`products`** | One row per distinct finished-good name per business (`UNIQUE (business_id, name)`). Created automatically when needed. |
| **`batches`** | A production run. **`product_id` is required** for new batches created via `create_production_batch`. Stores `cost_of_goods` (total ingredient cost for the batch) and `units_produced`. |
| **`sales`** | A sale line. Stores **`product_id`** (resolved from the name the user typed) and **`product_name`** (denormalized label for lists and reports). **`cogs`** is computed when the sale is saved. |
| **`items` + `stock_entries`** | Ingredient inventory and **weighted average cost (WAC)** in usage units (`items.avg_cost_per_usage_unit`). Used when a batch consumes stock. |

## Flow

1. **Baking**  
   User enters a product name (e.g. “Croissant”) and ingredient lines.  
   The app calls **`ensure_product`** → `products.id`, then **`create_production_batch`** with **`p_product_id`**.  
   The RPC writes `batches.product_id`, deducts stock, and sets `batches.cost_of_goods`.

2. **Sales**  
   User enters the same product name (exact match matters for the shared `products` row).  
   The app calls **`ensure_product`** again → same `products.id`, then loads **only** batches with `batches.product_id = that id` and `cost_of_goods` / `units_produced` set.

3. **COGS formula (per product)**  

   For batches of that product only:

   - **Average cost per output unit** = sum of `cost_of_goods` / sum of `units_produced` across those batches.
   - **Sale COGS** = `units_sold` × that average.

   If there are **no qualifying batches**, **`cogs` is stored as `NULL`** (unknown cost). The UI shows a dash for COGS; `gross_profit` in the database still uses `COALESCE(cogs, 0)` in its generated expression, so treat displayed profit with care when COGS is unknown.

## Implementation notes

- **Why `product_id` and not only `product_name`?**  
  Names are for people; IDs are stable for joins and averages. Typos create different products; that is acceptable for MVP and matches real-world “two names = two SKUs” unless the user standardizes.

- **Legacy data**  
  Older batches may have **`product_id` NULL** (before migration `20260403000011_per_product_costing.sql`). They are **excluded** from per-product averages. Re-log production or edit batches to attach a product if needed.

- **Inventory WAC vs product COGS**  
  Ingredient WAC (`items.avg_cost_per_usage_unit`) answers “what did flour cost per kg?”  
  Per-product batch averaging answers “what did *this croissant batch* cost per unit output?” They are different layers; both stay in use.

## Related code

- SQL: `ensure_product`, `create_production_batch` (see migration `20260403000011_per_product_costing.sql`).
- App: `apps/web/app/dashboard/sales/sales-page-client.tsx` (`computeAutoCogs`), `apps/web/lib/bakery/per-product-cogs.ts` (pure math helpers).
