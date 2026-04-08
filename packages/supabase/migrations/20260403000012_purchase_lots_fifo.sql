-- ============================================================
-- Purchase lots (stock batches) + FIFO production consumption
--
-- Each "Add stock" / opening stock creates a purchase_lot row with
-- quantity_remaining and a frozen cost_per_usage_unit. Production
-- deducts from lots in purchased_at order (FIFO). Optional
-- purchase_lot_id on a line uses that lot only (manual pick).
--
-- production_lot_allocations records slices so delete_production_batch
-- can restore lot balances. stock_entries stay the ledger for levels + WAC.
-- ============================================================

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_lots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  usage_quantity_initial numeric(12,4) NOT NULL CHECK (usage_quantity_initial > 0),
  quantity_remaining  numeric(12,4) NOT NULL CHECK (quantity_remaining >= 0),
  total_cost_paid     numeric(14,4) NOT NULL DEFAULT 0,
  cost_per_usage_unit numeric(18,6) NOT NULL DEFAULT 0,
  purchased_at        timestamptz NOT NULL DEFAULT now(),
  note                text,
  label               text NOT NULL DEFAULT 'Purchase'
);

CREATE INDEX IF NOT EXISTS idx_purchase_lots_item_business_fifo
  ON purchase_lots (item_id, business_id, purchased_at ASC)
  WHERE quantity_remaining > 0;

COMMENT ON TABLE purchase_lots IS
  'Each purchase (or opening balance) is a lot: remaining usage units and cost per usage unit for FIFO costing.';

CREATE TABLE IF NOT EXISTS production_lot_allocations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  purchase_lot_id  uuid NOT NULL REFERENCES purchase_lots(id) ON DELETE RESTRICT,
  item_id          uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity_usage   numeric(12,4) NOT NULL CHECK (quantity_usage > 0),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_lot_alloc_batch ON production_lot_allocations (batch_id);
CREATE INDEX IF NOT EXISTS idx_production_lot_alloc_lot ON production_lot_allocations (purchase_lot_id);

ALTER TABLE purchase_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lot_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON purchase_lots
  FOR ALL USING (
    business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
  );

CREATE POLICY tenant_isolation ON production_lot_allocations
  FOR ALL USING (
    business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- Backfill: one opening lot per item with on-hand stock
-- ------------------------------------------------------------
INSERT INTO purchase_lots (
  business_id,
  item_id,
  usage_quantity_initial,
  quantity_remaining,
  total_cost_paid,
  cost_per_usage_unit,
  purchased_at,
  note,
  label
)
SELECT
  i.business_id,
  i.id,
  sl.quantity_on_hand,
  sl.quantity_on_hand,
  ROUND(
    sl.quantity_on_hand * COALESCE(
      NULLIF(i.avg_cost_per_usage_unit, 0),
      NULLIF(i.cost_per_unit / NULLIF(i.conversion_ratio, 0), 0),
      0
    )::numeric,
    4
  ),
  COALESCE(
    NULLIF(i.avg_cost_per_usage_unit, 0),
    NULLIF(i.cost_per_unit / NULLIF(i.conversion_ratio, 0), 0),
    0
  ),
  now() - interval '1 day',
  'Migrated from existing stock',
  'Opening balance'
FROM stock_levels sl
JOIN items i ON i.id = sl.item_id
WHERE sl.quantity_on_hand > 0;

-- ------------------------------------------------------------
-- add_purchase_lot: restock / opening purchase as a lot + ledger row
-- p_purchase_qty = how many purchase units (bags, crates…)
-- p_total_cost_paid = full price paid for that line
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_purchase_lot(
  p_business_id uuid,
  p_item_id uuid,
  p_purchase_qty numeric,
  p_total_cost_paid numeric,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_item         items%ROWTYPE;
  v_usage        numeric;
  v_cpu          numeric;
  v_lot_id       uuid;
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

  IF p_purchase_qty IS NULL OR p_purchase_qty <= 0 THEN
    RAISE EXCEPTION 'purchase quantity must be positive';
  END IF;

  SELECT * INTO r_item
  FROM items
  WHERE id = p_item_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown item';
  END IF;

  v_usage := p_purchase_qty * COALESCE(r_item.conversion_ratio, 1);
  IF v_usage IS NULL OR v_usage <= 0 THEN
    RAISE EXCEPTION 'invalid conversion to usage units';
  END IF;

  v_cpu := CASE
    WHEN p_total_cost_paid > 0 THEN ROUND((p_total_cost_paid / v_usage)::numeric, 6)
    ELSE 0
  END;

  INSERT INTO purchase_lots (
    business_id,
    item_id,
    usage_quantity_initial,
    quantity_remaining,
    total_cost_paid,
    cost_per_usage_unit,
    purchased_at,
    note,
    label
  )
  VALUES (
    p_business_id,
    p_item_id,
    v_usage,
    v_usage,
    COALESCE(p_total_cost_paid, 0),
    v_cpu,
    now(),
    NULLIF(trim(p_note), ''),
    'Purchase'
  )
  RETURNING id INTO v_lot_id;

  INSERT INTO stock_entries (
    business_id,
    item_id,
    quantity,
    cost_per_unit,
    source,
    reference_id,
    note
  )
  VALUES (
    p_business_id,
    p_item_id,
    v_usage,
    v_cpu,
    'purchase',
    v_lot_id,
    COALESCE(NULLIF(trim(p_note), ''), 'Add stock')
  );

  RETURN v_lot_id;
END;
$$;

REVOKE ALL ON FUNCTION add_purchase_lot(uuid, uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_purchase_lot(uuid, uuid, numeric, numeric, text) TO authenticated;

-- ------------------------------------------------------------
-- delete_production_batch: restore purchase lots, then ledger
-- ------------------------------------------------------------
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

  UPDATE purchase_lots pl
  SET quantity_remaining = pl.quantity_remaining + a.quantity_usage
  FROM production_lot_allocations a
  WHERE a.purchase_lot_id = pl.id
    AND a.batch_id = p_batch_id;

  DELETE FROM production_lot_allocations WHERE batch_id = p_batch_id;

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

-- ------------------------------------------------------------
-- create_production_batch: FIFO (or manual lot) + allocations
-- p_lines: [{"item_id","quantity", "purchase_lot_id"?}, ...]
-- ------------------------------------------------------------
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

  -- Lock items in stable order (deadlock avoidance)
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

  -- Pass 1: consume purchase lots, build allocation JSON
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

  -- Total ingredient cost from allocations
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

REVOKE ALL ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_production_batch(uuid, numeric, timestamptz, text, text, jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION add_purchase_lot(uuid, uuid, numeric, numeric, text) IS
  'Creates a purchase lot and matching stock_entries row (usage units). Use for Add stock and opening stock.';

COMMENT ON COLUMN batches.units_remaining IS
  'Output units still available (e.g. for sale). Produced − sold − waste can be tracked over time; profit uses sales only.';
