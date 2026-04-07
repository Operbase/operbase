-- ============================================================
-- Per-product production cost for sales COGS
--
-- Problem: client-side COGS used SUM(cost_of_goods) / SUM(units_produced)
-- across every batch in the business, so different products (e.g. croissants
-- vs bread) incorrectly shared one average cost.
--
-- Fix:
--   1. ensure_product: get or create a products row (MVP catalog; name per business).
--   2. create_production_batch: require p_product_id; store batches.product_id.
--   3. App computes sale COGS only from batches where product_id matches the sale.
--
-- Legacy rows: batches.product_id and sales.product_id may be NULL; those batches
-- do not affect per-product averages. Re-save sales after logging production with
-- the same product name to refresh COGS if needed.
-- ============================================================

-- ------------------------------------------------------------
-- ensure_product: idempotent product row for this business
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_product(
  p_business_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trim text;
  v_id   uuid;
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

  v_trim := trim(p_name);
  IF v_trim = '' THEN
    RAISE EXCEPTION 'product name is required';
  END IF;

  IF length(v_trim) > 200 THEN
    RAISE EXCEPTION 'product name is too long';
  END IF;

  SELECT id INTO v_id
  FROM products
  WHERE business_id = p_business_id AND name = v_trim;

  IF FOUND THEN
    RETURN v_id;
  END IF;

  BEGIN
    INSERT INTO products (business_id, name)
    VALUES (p_business_id, v_trim)
    RETURNING id INTO v_id;
    RETURN v_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_id
      FROM products
      WHERE business_id = p_business_id AND name = v_trim;
      IF v_id IS NULL THEN
        RAISE;
      END IF;
      RETURN v_id;
  END;
END;
$$;

REVOKE ALL ON FUNCTION ensure_product(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_product(uuid, text) TO authenticated;

COMMENT ON FUNCTION ensure_product(uuid, text) IS
  'Returns products.id for trim(p_name), creating the row if needed. Scoped to p_business_id.';

-- ------------------------------------------------------------
-- create_production_batch: add p_product_id (required)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS create_production_batch(uuid, numeric, timestamptz, text, text, jsonb);

CREATE OR REPLACE FUNCTION create_production_batch(
  p_business_id uuid,
  p_units_produced numeric,
  p_produced_at timestamptz,
  p_display_name text,
  p_extra_notes text,
  p_lines jsonb,
  p_product_id uuid
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

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE id = p_product_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Unknown product';
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

  FOR v_idx IN 0..v_len - 1 LOOP
    v_line := p_lines->v_idx;

    IF (v_line->>'item_id') IS NULL OR (v_line->>'quantity') IS NULL THEN
      RAISE EXCEPTION 'Each line needs item_id and quantity';
    END IF;

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

    v_cost_usage := CASE
      WHEN r_item.avg_cost_per_usage_unit > 0
        THEN r_item.avg_cost_per_usage_unit
      ELSE COALESCE(r_item.cost_per_unit / NULLIF(r_item.conversion_ratio, 0), 0)
    END;

    v_total_cost := v_total_cost + (v_line->>'quantity')::numeric * v_cost_usage;
  END LOOP;

  v_notes := CASE
    WHEN p_extra_notes IS NOT NULL AND trim(p_extra_notes) <> ''
      THEN trim(p_display_name) || ' · ' || trim(p_extra_notes)
    ELSE trim(p_display_name)
  END;

  INSERT INTO batches (
    business_id,
    product_id,
    units_produced,
    units_remaining,
    produced_at,
    notes,
    cost_of_goods
  )
  VALUES (
    p_business_id,
    p_product_id,
    p_units_produced,
    p_units_produced,
    p_produced_at,
    v_notes,
    v_total_cost
  )
  RETURNING id INTO v_batch_id;

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

REVOKE ALL ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid) TO authenticated;

COMMENT ON COLUMN batches.product_id IS
  'Finished good this batch represents. Sales COGS averages cost only across batches with the same product_id.';
