# Changelog (engineering)

High-level record of behavior changes that affect the product or database. **Newest first.**

---

## 2026-04-03 — Logout clears `ob_onboarded` immediately

### What changed

- **`POST /api/auth/logout`** revokes the Supabase session (server-side cookie updates) and expires the httpOnly **`ob_onboarded`** cookie in the same response.
- **`signOut()`** in `lib/auth.ts` calls that route first, then the existing browser **`supabase.auth.signOut()`** so client state stays in sync.

### Why

`ob_onboarded` is httpOnly, so client-only sign-out could not remove it until the next middleware pass, which briefly made the user look “onboarded” without a session.

### Impact

- **Prod-safe**: additive route; no auth strategy change; long-lived sessions unchanged.
- Middleware still deletes **`ob_onboarded`** when there is no user (safety net for odd edge cases).

---

## 2026-04-03 — Per-product COGS for sales

### What changed

- **Sales COGS** is no longer a single weighted average across **all** batches in the business.
- It uses **only batches that share the same `product_id`** as the sale (the finished good).
- **`create_production_batch`** now requires **`p_product_id`** and sets **`batches.product_id`**.
- New RPC **`ensure_product(p_business_id, p_name)`** returns a `products` row id, creating the row if needed (trimmed name, max 200 characters enforced in SQL).

### Why

Different products (e.g. croissants vs bread) have different ingredient costs and batch economics. A global average mixed their margins and made profit misleading.

### Impact

- **Trust**: Profit per sale reflects the right production pool when batch data exists for that product.
- **UX**: Still “what did you bake?” / “what did you sell?” — names should **match** so they resolve to the same `products` row.
- **Legacy**: Batches or sales **without** `product_id` do not participate in the new average; COGS may be **unknown (`NULL`)** until production is logged with the new flow.

### Migration

- Apply **`packages/supabase/migrations/20260403000011_per_product_costing.sql`** after prior migrations (especially `20260403000010_weighted_average_cost.sql`).
- Drops the **6-argument** overload of `create_production_batch` and replaces it with a **7-argument** version (adds `p_product_id`).

### Docs

- See **`docs/costing-model.md`** for the full costing narrative.

---

*(Add older entries below when you make other foundational changes.)*
