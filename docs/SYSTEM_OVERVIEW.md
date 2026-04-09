# Operbase — System Overview

This document explains how the system works: what each part does, how data flows, and where to find things.

---

## What Operbase does

Operbase helps small business owners (starting with bakeries) answer three questions every day:

1. **What do I have?** — Stock of ingredients and packaging
2. **What did I make and sell?** — Production runs and sales
3. **Did I make money?** — Revenue, cost, and profit

---

## The four main parts

### 1. Stock

**What it is**: A list of everything you buy (flour, sugar, packaging boxes, etc.).

**How it works**:
- You add items with a name, the unit you buy in (e.g. a bag), and what it costs.
- When you buy more, you "restock" — this creates a **purchase lot** with a frozen price.
- When production uses an ingredient, stock goes down.
- The system uses **FIFO** (oldest purchase first) when deducting stock — so older, cheaper flour is used before newer, more expensive flour.

**Key database tables**: `items`, `stock_entries`, `purchase_lots`, `production_lot_allocations`

**Key code file**: `apps/web/app/dashboard/stock/stock-page-client.tsx`

---

### 2. Production

**What it is**: A record of each time you make something (a "run").

**How it works**:
- You record: what you made, how many, the date, and optionally what ingredients you used.
- If you used ingredients, production deducts them from stock using FIFO.
- The system calculates **cost of this run** = sum of (ingredient qty × ingredient cost per unit).
- You can also record how many were NOT for sale (samples, gifts).
- After production, you can log that some were **given away or did not sell** via the dispose dialog.

**Key numbers**:
- `units_produced`: how many you made in total
- `units_given_away`: not-for-sale at production time
- `units_remaining`: currently available to sell (= produced − given − sold − disposed)
- `units_sold_from_batch`: sold from this run
- `cost_of_goods`: total ingredient cost for this run

**Key database table**: `batches` (called "runs" in the UI)

**Key code file**: `apps/web/app/dashboard/production/production-page-client.tsx`

**Key RPCs**: `create_production_batch`, `delete_production_batch`, `dispose_batch_units`

---

### 3. Sales

**What it is**: A record of each sale.

**How it works**:
- You log: what you sold, how many, the price each, and the date.
- You can link a sale to a **production run** (this gives exact cost tracking) or log a **quick sale** (uses average cost from recent runs of that product).
- Each sale stores: `revenue` (price × quantity), `cogs` (cost of those items), `gross_profit` (revenue − cogs).
- Products are matched by name via `ensure_product` RPC — same name = same product = shared cost pool.

**Key code file**: `apps/web/app/dashboard/sales/sales-page-client.tsx`

**Key RPCs**: `record_sale_with_batch`, `delete_sale_restores_batch`, `ensure_product`

---

### 4. Dashboard

**What it is**: A summary of how the business is doing today.

**What it shows**:
- **Profit headline**: "You made X today" or "You lost X today"
- **At-risk items**: items waiting to be sold, with ingredient cost at stake
- **Today in numbers**: items made, items sold, money in, you kept (profit)
- **Quick actions**: links to the three most common tasks
- **Monthly spend breakdown**: what you spent on each ingredient (expandable)
- **AI assistant**: keyword-based Q&A (stock levels, weekly usage, today's profit/sales)

**Key code file**: `apps/web/app/dashboard/dashboard-home-client.tsx`

---

## How profit is calculated

1. **For a linked-batch sale**: `cogs = (units_sold / units_produced) × batch.cost_of_goods`
2. **For a quick sale**: `cogs = units_sold × weighted_average_cost_per_unit_for_this_product`
   - The average uses only batches for the **same product** (not all products).
3. **Gross profit**: `revenue − cogs`
4. **If no batches with costs exist**: `cogs = NULL`, profit shows as zero or unknown.

See `docs/costing-model.md` for the full costing model.

---

## How brand theming works

Each business sets a brand color at onboarding. The dashboard injects:

```css
:root {
  --brand: #d97706;         /* business's color */
  --brand-light: ...;       /* 12% tint */
  --brand-mid: ...;         /* 20% tint */
  --brand-dark: ...;        /* 85% dark */
}
```

All `bg-amber-600` buttons and amber accents in the dashboard are overridden to use `var(--brand)` via `DashboardBrandCss` component. This works inside dialogs too (Radix portals) because variables are set on `:root`.

---

## File structure (key paths)

```
apps/web/
  app/dashboard/
    page.tsx                       Dashboard home (server component, data fetch)
    dashboard-home-client.tsx      Dashboard UI
    production/
      page.tsx                     Production server component
      production-page-client.tsx   Production UI
    sales/
      page.tsx                     Sales server component
      sales-page-client.tsx        Sales UI
    stock/
      page.tsx                     Stock server component
      stock-page-client.tsx        Stock UI
    products/
      page.tsx                     Products server component
      products-page-client.tsx     Products UI (wizard)
  components/
    dashboard-brand-css.tsx        CSS variable injection for theming
    dashboard-layout.tsx           Shell layout with sidebar
    business-assistant.tsx         AI assistant widget
  lib/
    assistant/
      intent.ts                    Keyword-scoring intent detection
      data.ts                      Supabase data fetchers for assistant
      format.ts                    Plain-English answer formatters
    dashboard/
      load-home-data.ts            Dashboard data aggregation
      production-data.ts           Production data types and queries
      sales-data.ts                Sales data types and queries
      stock-data.ts                Stock data types and queries
      weekly-stock-data.ts         Weekly stock movement calculator
    bakery/
      cost.ts                      Cost math helpers
      per-product-cogs.ts          Per-product weighted average cost
packages/supabase/migrations/      All SQL migrations (run in order)
```

---

## Testing

Tests live in `apps/web/__tests__/`. Run with:

```bash
cd apps/web
npx vitest run
```

141 tests across 18 files covering: dashboard, production, sales, stock, hooks, and library functions.
