-- ============================================================
-- Add p_variant_id (DEFAULT NULL) to create_production_batch
-- and record_sale_with_batch so production runs and sales can
-- be tagged to a specific product variant.
--
-- Both params are at the end with DEFAULT NULL — fully
-- backwards-compatible with all existing callers.
-- ============================================================

-- ------------------------------------------------------------
-- create_production_batch  (8-arg → 9-arg)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid, numeric);

CREATE OR REPLACE FUNCTION create_production_batch(
  p_business_id        uuid,
  p_units_produced     numeric,
  p_produced_at        timestamptz,
  p_display_name       text,
  p_extra_notes        text,
  p_lines              jsonb,
  p_product_id         uuid,
  p_units_not_for_sale numeric DEFAULT 0,
  p_variant_id         uuid    DEFAULT NULL
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

  -- Validate variant belongs to this product if provided
  IF p_variant_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM product_variants
      WHERE id = p_variant_id AND product_id = p_product_id AND business_id = p_business_id
    ) THEN
      RAISE EXCEPTION 'Variant does not belong to this product';
    END IF;
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
    cost_of_goods,
    variant_id
  )
  VALUES (
    p_business_id,
    p_product_id,
    p_units_produced,
    v_remaining,
    v_given,
    p_produced_at,
    v_notes,
    v_total_cost,
    p_variant_id
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

REVOKE ALL ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid, numeric, uuid) TO authenticated;

-- ------------------------------------------------------------
-- record_sale_with_batch  (9-arg → 10-arg)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS record_sale_with_batch(uuid, uuid, text, numeric, numeric, timestamptz, uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION record_sale_with_batch(
  p_business_id    uuid,
  p_product_id     uuid,
  p_product_name   text,
  p_units_sold     numeric,
  p_unit_price     numeric,
  p_sold_at        timestamptz,
  p_customer_id    uuid,
  p_batch_id       uuid,
  p_cogs_if_no_batch numeric,
  p_variant_id     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  r_batch   batches%ROWTYPE;
  v_cogs    numeric;
  v_name    text;
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

  v_name := trim(COALESCE(p_product_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'product_name is required';
  END IF;

  IF p_units_sold IS NULL OR p_units_sold <= 0 THEN
    RAISE EXCEPTION 'How many must be a positive number';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price <= 0 THEN
    RAISE EXCEPTION 'Price each must be a positive number';
  END IF;

  IF p_batch_id IS NOT NULL THEN
    SELECT * INTO r_batch
    FROM batches
    WHERE id = p_batch_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'That run was not found';
    END IF;

    IF r_batch.product_id IS DISTINCT FROM p_product_id THEN
      RAISE EXCEPTION 'Product does not match this run';
    END IF;

    IF r_batch.units_remaining < p_units_sold THEN
      RAISE EXCEPTION 'Only % units left in this run', r_batch.units_remaining;
    END IF;

    IF r_batch.cost_of_goods IS NOT NULL AND r_batch.units_produced > 0 THEN
      v_cogs := p_units_sold * (r_batch.cost_of_goods / r_batch.units_produced);
    ELSE
      v_cogs := NULL;
    END IF;

    INSERT INTO sales (
      business_id, customer_id, batch_id, product_id, product_name,
      units_sold, unit_price, sold_at, cogs, variant_id
    )
    VALUES (
      p_business_id, p_customer_id, p_batch_id, p_product_id, v_name,
      p_units_sold, p_unit_price, p_sold_at, v_cogs, p_variant_id
    )
    RETURNING id INTO v_sale_id;

    UPDATE batches
    SET
      units_remaining        = units_remaining - p_units_sold,
      units_sold_from_batch  = units_sold_from_batch + p_units_sold
    WHERE id = p_batch_id;

    RETURN v_sale_id;
  END IF;

  -- No batch
  INSERT INTO sales (
    business_id, customer_id, batch_id, product_id, product_name,
    units_sold, unit_price, sold_at, cogs, variant_id
  )
  VALUES (
    p_business_id, p_customer_id, NULL, p_product_id, v_name,
    p_units_sold, p_unit_price, p_sold_at, p_cogs_if_no_batch, p_variant_id
  )
  RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION record_sale_with_batch(uuid, uuid, text, numeric, numeric, timestamptz, uuid, uuid, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_sale_with_batch(uuid, uuid, text, numeric, numeric, timestamptz, uuid, uuid, numeric, uuid) TO authenticated;
