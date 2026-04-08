-- ============================================================
-- Optional giveaway / waste at production time
--
-- Cost of goods still covers the full run (ingredients for all
-- units produced). units_remaining starts at (produced − given away)
-- so sales only attach to sellable stock. Per-product COGS average
-- still divides by units_produced (full run), not only sellable units.
-- ============================================================

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS units_given_away numeric(12,4) NOT NULL DEFAULT 0
  CHECK (units_given_away >= 0);

COMMENT ON COLUMN batches.units_given_away IS
  'From this production run: samples, waste, or gifts — not for sale. Does not change cost_of_goods.';

-- Replace 7-arg create_production_batch with 8-arg (last param optional for callers)
DROP FUNCTION IF EXISTS create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid);

CREATE OR REPLACE FUNCTION create_production_batch(
  p_business_id uuid,
  p_units_produced numeric,
  p_produced_at timestamptz,
  p_display_name text,
  p_extra_notes text,
  p_lines jsonb,
  p_product_id uuid,
  p_units_not_for_sale numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id     uuid;
  v_total_cost   numeric := 0;
  r_item         items%ROWTYPE;
  r_lot          purchase_lots%ROWTYPE;
  v_line         jsonb;
  v_idx          int;
  v_len          int;
  v_need         numeric;
  v_take         numeric;
  v_line_cost    numeric;
  v_line_qty     numeric;
  v_cpu_line     numeric;
  v_notes        text;
  v_allocs       jsonb := '[]'::jsonb;
  v_manual_lot   uuid;
  v_item_uuid    uuid;
  v_given        numeric;
  v_remaining    numeric;
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

  v_given := GREATEST(0, COALESCE(p_units_not_for_sale, 0));
  IF v_given > p_units_produced THEN
    RAISE EXCEPTION 'Giveaway or waste cannot be more than how many you made';
  END IF;
  v_remaining := p_units_produced - v_given;

  IF p_display_name IS NULL OR trim(p_display_name) = '' THEN
    RAISE EXCEPTION 'display_name is required';
  END IF;

  IF p_lines IS NULL THEN
    p_lines := '[]'::jsonb;
  END IF;

  v_len := jsonb_array_length(p_lines);

  FOR v_item_uuid IN
    SELECT DISTINCT (t.l->>'item_id')::uuid AS id
    FROM jsonb_array_elements(p_lines) AS t(l)
    WHERE (t.l->>'item_id') IS NOT NULL
    ORDER BY 1
  LOOP
    SELECT * INTO r_item
    FROM items
    WHERE id = v_item_uuid AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown item';
    END IF;
  END LOOP;

  FOR v_idx IN 0..v_len - 1 LOOP
    v_line := p_lines->v_idx;

    IF (v_line->>'item_id') IS NULL OR (v_line->>'quantity') IS NULL THEN
      RAISE EXCEPTION 'Each line needs item_id and quantity';
    END IF;

    SELECT * INTO r_item
    FROM items
    WHERE id = (v_line->>'item_id')::uuid AND business_id = p_business_id
    FOR UPDATE;

    v_need := (v_line->>'quantity')::numeric;
    IF v_need IS NULL OR v_need <= 0 THEN
      RAISE EXCEPTION 'Each line needs a positive quantity';
    END IF;

    v_manual_lot := NULL;
    IF (v_line ? 'purchase_lot_id')
       AND (v_line->>'purchase_lot_id') IS NOT NULL
       AND trim(v_line->>'purchase_lot_id') <> '' THEN
      v_manual_lot := (v_line->>'purchase_lot_id')::uuid;
    END IF;

    IF v_manual_lot IS NOT NULL THEN
      SELECT * INTO r_lot
      FROM purchase_lots
      WHERE id = v_manual_lot
        AND item_id = r_item.id
        AND business_id = p_business_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown stock lot for %', r_item.name;
      END IF;

      IF r_lot.quantity_remaining < v_need THEN
        RAISE EXCEPTION 'Not enough stock in the selected lot for %', r_item.name;
      END IF;

      UPDATE purchase_lots
      SET quantity_remaining = quantity_remaining - v_need
      WHERE id = r_lot.id;

      v_allocs := v_allocs || jsonb_build_array(
        jsonb_build_object(
          'line_idx', v_idx,
          'lot_id', r_lot.id,
          'item_id', r_item.id,
          'qty', v_need,
          'cost_u', r_lot.cost_per_usage_unit
        )
      );
    ELSE
      WHILE v_need > 0 LOOP
        SELECT * INTO r_lot
        FROM purchase_lots
        WHERE item_id = r_item.id
          AND business_id = p_business_id
          AND quantity_remaining > 0
        ORDER BY purchased_at ASC, id ASC
        FOR UPDATE
        SKIP LOCKED
        LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Insufficient stock for % (add stock first)', r_item.name;
        END IF;

        v_take := LEAST(v_need, r_lot.quantity_remaining);

        UPDATE purchase_lots
        SET quantity_remaining = quantity_remaining - v_take
        WHERE id = r_lot.id;

        v_allocs := v_allocs || jsonb_build_array(
          jsonb_build_object(
            'line_idx', v_idx,
            'lot_id', r_lot.id,
            'item_id', r_item.id,
            'qty', v_take,
            'cost_u', r_lot.cost_per_usage_unit
          )
        );

        v_need := v_need - v_take;
      END LOOP;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM((e->>'qty')::numeric * (e->>'cost_u')::numeric), 0)
  INTO v_total_cost
  FROM jsonb_array_elements(v_allocs) AS t(e);

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
    units_given_away,
    produced_at,
    notes,
    cost_of_goods
  )
  VALUES (
    p_business_id,
    p_product_id,
    p_units_produced,
    v_remaining,
    v_given,
    p_produced_at,
    v_notes,
    v_total_cost
  )
  RETURNING id INTO v_batch_id;

  INSERT INTO production_lot_allocations (
    batch_id, purchase_lot_id, item_id, quantity_usage, business_id
  )
  SELECT
    v_batch_id,
    (elem->>'lot_id')::uuid,
    (elem->>'item_id')::uuid,
    (elem->>'qty')::numeric,
    p_business_id
  FROM jsonb_array_elements(v_allocs) AS x(elem);

  FOR v_idx IN 0..v_len - 1 LOOP
    v_line := p_lines->v_idx;
    v_line_qty := (v_line->>'quantity')::numeric;

    SELECT COALESCE(SUM((elem->>'qty')::numeric * (elem->>'cost_u')::numeric), 0)
    INTO v_line_cost
    FROM jsonb_array_elements(v_allocs) AS t(elem)
    WHERE (elem->>'line_idx')::int = v_idx;

    v_cpu_line := CASE
      WHEN v_line_qty > 0 THEN v_line_cost / v_line_qty
      ELSE 0
    END;

    SELECT * INTO r_item FROM items WHERE id = (v_line->>'item_id')::uuid;

    INSERT INTO batch_items (batch_id, item_id, quantity, unit_id, cost, business_id)
    VALUES (
      v_batch_id,
      r_item.id,
      v_line_qty,
      r_item.usage_unit_id,
      v_line_cost,
      p_business_id
    );

    INSERT INTO stock_entries (
      business_id, item_id, quantity, cost_per_unit, source, reference_id, note
    )
    VALUES (
      p_business_id,
      r_item.id,
      -v_line_qty,
      v_cpu_line,
      'batch_deduction',
      v_batch_id,
      'Record production'
    );
  END LOOP;

  RETURN v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid, numeric) TO authenticated;

COMMENT ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid, numeric) IS
  'Creates production batch; deducts ingredient stock via FIFO purchase_lots unless purchase_lot_id on a line. p_units_not_for_sale reduces sellable units_remaining only.';
