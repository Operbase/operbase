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
| Dispose units | Log giveaways and waste after production via "Gave away / lost" dialog. |
| Sales logging | From a production run (links real stock) or quick sale (average cost). |
| Per-product profit (COGS) | Each product uses its own production batches only — no blended average. |
| FIFO stock deduction | Stock consumed oldest-purchase-first unless manually overridden. |
| Product catalog | 3-step wizard: name → types (variants) → extras (add-ons). |
| Dashboard | Today's profit, items waiting to sell, money in + you kept cards, quick actions. |
| Brand theming | CSS variables (`var(--brand)`) injected at `:root` — works in dialogs too. |
| Rule-based AI assistant | Answers stock/usage/profit/sales questions using keyword scoring. No external API. |
| Multi-tenant auth + RLS | All data scoped to `business_id`. |
| Business onboarding | Name, currency, timezone, logo, brand color. |

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

## DONE — Database constraints

| Constraint | Migration |
|-----------|-----------|
| `sales.product_id NOT NULL` | 20260409000018 |
| `products` UNIQUE (business_id, name) | 20260403000011 |
| `product_variants` and `product_addons` tables | 20260409000016 |
| `variant_id` on batches and sales (nullable) | 20260409000016 |
| FIFO lot allocation tracking | 20260403000012 |

---

## INCOMPLETE

| Feature | What is missing |
|---------|-----------------|
| Business settings UI | Currency/timezone set at onboarding but no "edit settings" page. |
| Low-stock push/email alerts | Threshold works in UI but no notification is sent. |
| variant_id set via separate UPDATE call after sale | Should be bundled into `record_sale_with_batch` RPC. |
| Multi-user roles | Schema scaffolded (`roles`, `permissions`, `invites`). No UI. |

---

## NOT STARTED (mapped to roadmap phases)

| Feature | Phase |
|---------|-------|
| Business settings edit page | Phase 1.5 |
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
