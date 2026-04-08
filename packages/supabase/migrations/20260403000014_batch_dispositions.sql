-- ============================================================
-- Batch lifecycle: explicit sold / spoiled / given out / didn't sell
-- Sales linked to a batch decrement units_remaining and increment
-- units_sold_from_batch. Remaining stock can be disposed without revenue.
-- ============================================================

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS units_sold_from_batch numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_spoiled numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_given_out_extra numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_not_sold_loss numeric(12,4) NOT NULL DEFAULT 0;

ALTER TABLE batches
  DROP CONSTRAINT IF EXISTS batches_disposition_nonneg;

ALTER TABLE batches
  ADD CONSTRAINT batches_disposition_nonneg CHECK (
    units_sold_from_batch >= 0
    AND units_spoiled >= 0
    AND units_given_out_extra >= 0
    AND units_not_sold_loss >= 0
  );

COMMENT ON COLUMN batches.units_sold_from_batch IS
  'Units sold from this run (also decreases units_remaining).';
COMMENT ON COLUMN batches.units_spoiled IS
  'Units marked went bad after production; removed from remaining.';
COMMENT ON COLUMN batches.units_given_out_extra IS
  'Units given away after production (not at make time); removed from remaining.';
COMMENT ON COLUMN batches.units_not_sold_loss IS
  'Units written off as did not sell; full per-unit cost is lost; removed from remaining.';

-- Implied sold before this migration: produced − giveaway − remaining
UPDATE batches
SET units_sold_from_batch = GREATEST(
  0,
  units_produced - COALESCE(units_given_away, 0) - COALESCE(units_remaining, 0)
)
WHERE true;

-- ------------------------------------------------------------
-- record_sale_with_batch: attach sale to batch (FIFO enforced in app) or legacy null batch
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_sale_with_batch(
  p_business_id uuid,
  p_product_id uuid,
  p_product_name text,
  p_units_sold numeric,
  p_unit_price numeric,
  p_sold_at timestamptz,
  p_customer_id uuid,
  p_batch_id uuid,
  p_cogs_if_no_batch numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  r_batch     batches%ROWTYPE;
  v_cogs      numeric;
  v_name      text;
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
      business_id,
      customer_id,
      batch_id,
      product_id,
      product_name,
      units_sold,
      unit_price,
      sold_at,
      cogs
    )
    VALUES (
      p_business_id,
      p_customer_id,
      p_batch_id,
      p_product_id,
      v_name,
      p_units_sold,
      p_unit_price,
      p_sold_at,
      v_cogs
    )
    RETURNING id INTO v_sale_id;

    UPDATE batches
    SET
      units_remaining = units_remaining - p_units_sold,
      units_sold_from_batch = units_sold_from_batch + p_units_sold
    WHERE id = p_batch_id;

    RETURN v_sale_id;
  END IF;

  INSERT INTO sales (
    business_id,
    customer_id,
    batch_id,
    product_id,
    product_name,
    units_sold,
    unit_price,
    sold_at,
    cogs
  )
  VALUES (
    p_business_id,
    p_customer_id,
    NULL,
    p_product_id,
    v_name,
    p_units_sold,
    p_unit_price,
    p_sold_at,
    p_cogs_if_no_batch
  )
  RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION record_sale_with_batch(
  uuid, uuid, text, numeric, numeric, timestamptz, uuid, uuid, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_sale_with_batch(
  uuid, uuid, text, numeric, numeric, timestamptz, uuid, uuid, numeric
) TO authenticated;

-- ------------------------------------------------------------
-- dispose_batch_units: remove from remaining without a sale
-- p_kind: spoiled | given_out | not_sold
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION dispose_batch_units(
  p_batch_id uuid,
  p_quantity numeric,
  p_kind text
)
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

  SELECT b.* INTO r_batch
  FROM batches b
  WHERE b.id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That run was not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_businesses
    WHERE user_id = auth.uid() AND business_id = r_batch.business_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('spoiled', 'given_out', 'not_sold') THEN
    RAISE EXCEPTION 'Invalid disposition';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'How many must be a positive number';
  END IF;

  IF r_batch.units_remaining < p_quantity THEN
    RAISE EXCEPTION 'Only % units left in this run', r_batch.units_remaining;
  END IF;

  UPDATE batches
  SET
    units_remaining = units_remaining - p_quantity,
    units_spoiled = units_spoiled + CASE WHEN p_kind = 'spoiled' THEN p_quantity ELSE 0 END,
    units_given_out_extra = units_given_out_extra + CASE WHEN p_kind = 'given_out' THEN p_quantity ELSE 0 END,
    units_not_sold_loss = units_not_sold_loss + CASE WHEN p_kind = 'not_sold' THEN p_quantity ELSE 0 END
  WHERE id = p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION dispose_batch_units(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispose_batch_units(uuid, numeric, text) TO authenticated;

-- ------------------------------------------------------------
-- delete_sale_restores_batch: undo sale and put units back on the run
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_sale_restores_batch(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_sale sales%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO r_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_businesses
    WHERE user_id = auth.uid() AND business_id = r_sale.business_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF r_sale.batch_id IS NOT NULL THEN
    UPDATE batches
    SET
      units_remaining = units_remaining + r_sale.units_sold,
      units_sold_from_batch = units_sold_from_batch - r_sale.units_sold
    WHERE id = r_sale.batch_id;
  END IF;

  DELETE FROM sales WHERE id = p_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION delete_sale_restores_batch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_sale_restores_batch(uuid) TO authenticated;
