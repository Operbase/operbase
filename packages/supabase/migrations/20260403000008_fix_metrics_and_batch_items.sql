-- ============================================================
-- Migration 00008: Fix two bugs introduced in 00006 + 00005/00007
--
-- Bug 1 (00006): dashboard_metrics was missing RETURN NEXT;
--   RETURNS TABLE in PL/pgSQL needs an explicit RETURN NEXT to
--   emit the row. Without it the function returns 0 rows and the
--   dashboard always shows all zeros.
--
-- Bug 2 (00005 + 00007): create_production_batch did not populate
--   batch_items.business_id. Migration 00007 added that column
--   and put RLS on it (user_in_business(business_id)). Any batch
--   created after 00007 was applied has business_id = NULL on its
--   ingredient rows, making them invisible to all users.
-- ============================================================

-- ============================================================
-- Fix 1: dashboard_metrics — add RETURN NEXT
-- ============================================================
CREATE OR REPLACE FUNCTION dashboard_metrics(
  p_business_id uuid
)
RETURNS TABLE (
  total_revenue    numeric,
  total_cogs       numeric,
  gross_profit     numeric,
  total_sales      bigint,
  total_batches    bigint,
  total_items      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT
    COALESCE(SUM(s.revenue), 0),
    COALESCE(SUM(s.cogs), 0),
    COALESCE(SUM(s.gross_profit), 0),
    COUNT(*)
  INTO total_revenue, total_cogs, gross_profit, total_sales
  FROM sales s
  WHERE s.business_id = p_business_id;

  SELECT COUNT(*) INTO total_batches
  FROM batches b
  WHERE b.business_id = p_business_id;

  SELECT COUNT(*) INTO total_items
  FROM items i
  WHERE i.business_id = p_business_id;

  RETURN NEXT; -- emit the single summary row
END;
$$;

REVOKE ALL ON FUNCTION dashboard_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dashboard_metrics(uuid) TO authenticated;

-- ============================================================
-- Fix 2: backfill any batch_items rows that slipped through
--         with NULL business_id (created between 00007 and now)
-- ============================================================
UPDATE batch_items bi
SET business_id = b.business_id
FROM batches b
WHERE bi.batch_id = b.id
  AND bi.business_id IS NULL;

-- ============================================================
-- Fix 2 cont: recreate create_production_batch to always write
--             business_id into batch_items
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

  -- First pass: validate, lock, and sum cost
  -- Lock item rows in consistent order to prevent deadlocks
  FOR v_idx IN 0..v_len - 1 LOOP
    v_line := p_lines->v_idx;

    IF (v_line->>'item_id') IS NULL OR (v_line->>'quantity') IS NULL THEN
      RAISE EXCEPTION 'Each line needs item_id and quantity';
    END IF;

    -- SELECT FOR UPDATE: blocks concurrent batch creation on the same item
    SELECT * INTO r_item
    FROM items
    WHERE id = (v_line->>'item_id')::uuid AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown item';
    END IF;

    -- Check stock under lock
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock
    FROM stock_entries
    WHERE item_id = r_item.id AND business_id = p_business_id;

    IF v_stock < (v_line->>'quantity')::numeric THEN
      RAISE EXCEPTION 'Insufficient stock for %', r_item.name;
    END IF;

    v_cost_usage := r_item.cost_per_unit / NULLIF(r_item.conversion_ratio, 0);
    IF v_cost_usage IS NULL THEN v_cost_usage := 0; END IF;

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
  FOR v_idx IN 0..v_len - 1 LOOP
    v_line := p_lines->v_idx;

    SELECT * INTO r_item FROM items WHERE id = (v_line->>'item_id')::uuid;

    v_cost_usage := r_item.cost_per_unit / NULLIF(r_item.conversion_ratio, 0);
    IF v_cost_usage IS NULL THEN v_cost_usage := 0; END IF;

    v_line_cost := (v_line->>'quantity')::numeric * v_cost_usage;

    -- business_id now included so RLS policy (user_in_business(business_id)) works
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

REVOKE ALL ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb) TO authenticated;
