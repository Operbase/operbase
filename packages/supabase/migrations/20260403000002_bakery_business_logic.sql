-- ============================================================
-- Bakery business logic: item purchase/usage units, batch
-- consumption, spend insights, safe batch delete (stock restore).
-- ============================================================

-- Item unit economics (stock quantities are always in *usage* units)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS purchase_unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usage_unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversion_ratio numeric(18, 6) NOT NULL DEFAULT 1
    CHECK (conversion_ratio > 0),
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric(12, 4);

COMMENT ON COLUMN items.cost_per_unit IS 'Cost per purchase unit (e.g. per bag, per case)';
COMMENT ON COLUMN items.conversion_ratio IS 'Usage units per one purchase unit (e.g. 25 kg per 1 bag)';
COMMENT ON COLUMN items.low_stock_threshold IS 'Alert when on-hand (usage units) is at or below this; NULL = no threshold';

UPDATE items
SET
  purchase_unit_id = COALESCE(purchase_unit_id, unit_id),
  usage_unit_id = COALESCE(usage_unit_id, unit_id)
WHERE purchase_unit_id IS NULL OR usage_unit_id IS NULL;

-- ============================================================
-- create_production_batch: batch + batch_items + stock deductions (one tx)
-- p_lines: [{"item_id": "<uuid>", "quantity": <numeric usage>}]
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

  -- First pass: validate and sum cost
  FOR v_idx IN 0..v_len - 1 LOOP
    v_line := p_lines->v_idx;

    IF (v_line->>'item_id') IS NULL OR (v_line->>'quantity') IS NULL THEN
      RAISE EXCEPTION 'Each line needs item_id and quantity';
    END IF;

    SELECT * INTO r_item
    FROM items
    WHERE id = (v_line->>'item_id')::uuid AND business_id = p_business_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown item';
    END IF;

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

    INSERT INTO batch_items (batch_id, item_id, quantity, unit_id, cost)
    VALUES (
      v_batch_id, r_item.id, (v_line->>'quantity')::numeric,
      r_item.usage_unit_id, v_line_cost
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

-- ============================================================
-- delete_production_batch: restore stock then delete batch
-- ============================================================
CREATE OR REPLACE FUNCTION delete_production_batch(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_batch batches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO r_batch FROM batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_businesses
    WHERE user_id = auth.uid() AND business_id = r_batch.business_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO stock_entries (
    business_id, item_id, quantity, cost_per_unit, source, reference_id, note
  )
  SELECT
    r_batch.business_id,
    bi.item_id,
    bi.quantity,
    CASE WHEN bi.quantity <> 0 THEN bi.cost / bi.quantity ELSE 0 END,
    'batch_reversal',
    p_batch_id,
    'Batch deleted — stock restored'
  FROM batch_items bi
  WHERE bi.batch_id = p_batch_id;

  DELETE FROM batches WHERE id = p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION delete_production_batch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_production_batch(uuid) TO authenticated;

-- ============================================================
-- monthly_spend_by_item: purchase + manual restock $ by item
-- ============================================================
CREATE OR REPLACE FUNCTION monthly_spend_by_item(
  p_business_id uuid,
  p_year int,
  p_month int
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  total_spend numeric
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

  RETURN QUERY
  SELECT
    se.item_id,
    i.name::text,
    SUM(se.quantity * COALESCE(se.cost_per_unit, 0))::numeric AS total_spend
  FROM stock_entries se
  JOIN items i ON i.id = se.item_id
  WHERE se.business_id = p_business_id
    AND se.source IN ('purchase', 'manual')
    AND EXTRACT(YEAR FROM se.created_at AT TIME ZONE 'UTC')::int = p_year
    AND EXTRACT(MONTH FROM se.created_at AT TIME ZONE 'UTC')::int = p_month
  GROUP BY se.item_id, i.name
  ORDER BY total_spend DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION monthly_spend_by_item(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION monthly_spend_by_item(uuid, int, int) TO authenticated;
