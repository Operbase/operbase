-- ============================================================
-- Migration 00010: Weighted Average Cost (WAC)
--
-- Problem: create_production_batch used items.cost_per_unit
-- (latest purchase price) for COGS. If the price changed between
-- purchases, batch costs were inaccurate.
--
-- Solution: maintain a rolling WAC on items.avg_cost_per_usage_unit.
-- A trigger updates this on every purchase stock entry.
-- create_production_batch reads WAC directly for COGS.
--
-- WAC formula (per purchase event):
--   new_avg = (existing_qty * existing_avg + new_qty * new_cost)
--             / (existing_qty + new_qty)
--
-- avg_cost_per_usage_unit is in USAGE units (same unit as
-- stock_entries.quantity) so no conversion is needed at read time.
-- ============================================================

-- ============================================================
-- 1. Add avg_cost_per_usage_unit column to items
-- ============================================================
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS avg_cost_per_usage_unit numeric(18,6) NOT NULL DEFAULT 0;

COMMENT ON COLUMN items.avg_cost_per_usage_unit IS
  'Rolling weighted average cost per usage unit. Updated automatically by '
  'trg_stock_entry_wac on every purchase/manual stock entry. '
  'Used by create_production_batch for COGS. Never edit directly.';

-- ============================================================
-- 2. Backfill existing items
--    Simplified WAC = total_purchase_cost / total_purchase_qty
--    across all historical positive purchase/manual entries.
--    Falls back to cost_per_unit / conversion_ratio if no entries.
-- ============================================================
UPDATE items i
SET avg_cost_per_usage_unit = COALESCE(
  (
    SELECT
      CASE
        WHEN SUM(se.quantity) > 0
        THEN ROUND(
          SUM(se.quantity * COALESCE(se.cost_per_unit, 0)) / SUM(se.quantity),
          6
        )
        ELSE NULL
      END
    FROM stock_entries se
    WHERE se.item_id = i.id
      AND se.quantity > 0
      AND se.source IN ('purchase', 'manual')
      AND se.cost_per_unit IS NOT NULL
      AND se.cost_per_unit > 0
  ),
  -- Fall back: derive from cost_per_unit + conversion_ratio
  CASE
    WHEN i.conversion_ratio > 0
    THEN ROUND(i.cost_per_unit / i.conversion_ratio, 6)
    ELSE 0
  END
);

-- ============================================================
-- 3. Trigger function: update WAC on stock entry insert
-- ============================================================
CREATE OR REPLACE FUNCTION _update_item_wac()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_qty  numeric;
  v_existing_avg  numeric;
  v_new_avg       numeric;
BEGIN
  -- Only update WAC for real purchases/manual adjustments with a known cost.
  -- Batch deductions (batch_deduction) and reversals (batch_reversal)
  -- do NOT change the cost basis — they just move stock.
  IF NEW.quantity <= 0
     OR NEW.cost_per_unit IS NULL
     OR NEW.cost_per_unit <= 0
     OR NEW.source NOT IN ('purchase', 'manual')
  THEN
    RETURN NEW;
  END IF;

  -- Qty on hand BEFORE this entry (trigger fires AFTER INSERT,
  -- so the row is already counted in stock_entries).
  SELECT COALESCE(SUM(quantity), 0) - NEW.quantity
  INTO v_existing_qty
  FROM stock_entries
  WHERE item_id = NEW.item_id;

  -- Current WAC from items table.
  SELECT COALESCE(avg_cost_per_usage_unit, 0)
  INTO v_existing_avg
  FROM items
  WHERE id = NEW.item_id;

  -- If stock was fully depleted (zero or negative) before this purchase,
  -- reset WAC to the new purchase price — no old cost basis to blend.
  IF v_existing_qty <= 0 THEN
    v_new_avg := NEW.cost_per_unit;
  ELSE
    v_new_avg := (
      (v_existing_qty * v_existing_avg) + (NEW.quantity * NEW.cost_per_unit)
    ) / (v_existing_qty + NEW.quantity);
  END IF;

  UPDATE items
  SET avg_cost_per_usage_unit = ROUND(v_new_avg, 6)
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$;

-- Drop first so it's idempotent
DROP TRIGGER IF EXISTS trg_stock_entry_wac ON stock_entries;

CREATE TRIGGER trg_stock_entry_wac
  AFTER INSERT ON stock_entries
  FOR EACH ROW
  EXECUTE FUNCTION _update_item_wac();

-- ============================================================
-- 4. Update create_production_batch to use WAC
--    Changes:
--    - First pass:  v_cost_usage = avg_cost_per_usage_unit
--    - Second pass: same (reads same locked item row)
--    - stock_entry cost_per_unit records the WAC at batch time
--      (historical snapshot in the ledger)
-- ============================================================
CREATE OR REPLACE FUNCTION create_production_batch(
  p_business_id uuid,
  p_units_produced numeric,
  p_produced_at timestamptz,
  p_display_name text,
  p_extra_notes text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id   uuid;
  v_total_cost numeric := 0;
  r_item       items%ROWTYPE;
  v_cost_usage numeric;
  v_line_cost  numeric;
  v_stock      numeric;
  v_notes      text;
  v_line       jsonb;
  v_idx        int;
  v_len        int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_businesses
    WHERE user_id = auth.uid() AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_units_produced IS NULL OR p_units_produced <= 0 THEN
    RAISE EXCEPTION 'units_produced must be positive';
  END IF;

  IF p_display_name IS NULL OR trim(p_display_name) = '' THEN
    RAISE EXCEPTION 'display_name is required';
  END IF;

  IF p_lines IS NULL THEN
    p_lines := '[]'::jsonb;
  END IF;

  v_len := jsonb_array_length(p_lines);

  -- First pass: validate, lock rows, sum cost using WAC
  FOR v_idx IN 0..v_len - 1 LOOP
    v_line := p_lines->v_idx;

    IF (v_line->>'item_id') IS NULL OR (v_line->>'quantity') IS NULL THEN
      RAISE EXCEPTION 'Each line needs item_id and quantity';
    END IF;

    -- Lock item row; also reads avg_cost_per_usage_unit
    SELECT * INTO r_item
    FROM items
    WHERE id = (v_line->>'item_id')::uuid AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown item';
    END IF;

    SELECT COALESCE(SUM(quantity), 0) INTO v_stock
    FROM stock_entries
    WHERE item_id = r_item.id AND business_id = p_business_id;

    IF v_stock < (v_line->>'quantity')::numeric THEN
      RAISE EXCEPTION 'Insufficient stock for %', r_item.name;
    END IF;

    -- Use WAC (usage units). Fall back to latest price if WAC not yet computed.
    v_cost_usage := CASE
      WHEN r_item.avg_cost_per_usage_unit > 0
        THEN r_item.avg_cost_per_usage_unit
      ELSE COALESCE(r_item.cost_per_unit / NULLIF(r_item.conversion_ratio, 0), 0)
    END;

    v_total_cost := v_total_cost + (v_line->>'quantity')::numeric * v_cost_usage;
  END LOOP;

  v_notes := CASE
    WHEN p_extra_notes IS NOT NULL AND trim(p_extra_notes) <> ''
      THEN trim(p_display_name) || ' — ' || trim(p_extra_notes)
    ELSE trim(p_display_name)
  END;

  INSERT INTO batches (
    business_id, units_produced, units_remaining, produced_at, notes, cost_of_goods
  )
  VALUES (
    p_business_id, p_units_produced, p_units_produced,
    p_produced_at, v_notes, v_total_cost
  )
  RETURNING id INTO v_batch_id;

  -- Second pass: write batch_items + stock deductions
  -- Reads the same locked item rows — WAC is still valid within this transaction
  FOR v_idx IN 0..v_len - 1 LOOP
    v_line := p_lines->v_idx;

    SELECT * INTO r_item FROM items WHERE id = (v_line->>'item_id')::uuid;

    v_cost_usage := CASE
      WHEN r_item.avg_cost_per_usage_unit > 0
        THEN r_item.avg_cost_per_usage_unit
      ELSE COALESCE(r_item.cost_per_unit / NULLIF(r_item.conversion_ratio, 0), 0)
    END;

    v_line_cost := (v_line->>'quantity')::numeric * v_cost_usage;

    INSERT INTO batch_items (batch_id, item_id, quantity, unit_id, cost, business_id)
    VALUES (
      v_batch_id, r_item.id, (v_line->>'quantity')::numeric,
      r_item.usage_unit_id, v_line_cost, p_business_id
    );

    -- stock_entry records the WAC used at batch time — historical snapshot
    INSERT INTO stock_entries (
      business_id, item_id, quantity, cost_per_unit, source, reference_id, note
    )
    VALUES (
      p_business_id, r_item.id, -(v_line->>'quantity')::numeric,
      v_cost_usage, 'batch_deduction', v_batch_id, 'Production batch'
    );
  END LOOP;

  RETURN v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb) TO authenticated;
