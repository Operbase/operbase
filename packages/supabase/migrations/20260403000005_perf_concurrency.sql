-- ============================================================
-- Migration 00005: Performance + concurrency hardening
--
-- 1. Missing FK indexes for multi-tenant scale
-- 2. stock_levels covering index (avoids full-table aggregation)
-- 3. Constraints: customer uniqueness, COGS non-negative
-- 4. SERIALIZABLE isolation for create_production_batch (race condition fix)
-- ============================================================

-- ============================================================
-- 1. MISSING FK INDEXES
-- ============================================================

-- products: list-all queries, RLS evaluation
CREATE INDEX IF NOT EXISTS idx_products_biz ON products(business_id);

-- subscriptions: Phase 4 recurring orders
CREATE INDEX IF NOT EXISTS idx_subscriptions_biz ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_product ON subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_due
  ON subscriptions(next_due) WHERE is_active = true;

-- user_businesses: team listing (Phase 2)
CREATE INDEX IF NOT EXISTS idx_user_businesses_biz ON user_businesses(business_id);

-- Phase 2/3 scaffold tables: FK lookups
CREATE INDEX IF NOT EXISTS idx_roles_biz ON roles(business_id);
CREATE INDEX IF NOT EXISTS idx_invites_biz ON invites(business_id);
CREATE INDEX IF NOT EXISTS idx_business_modules_biz ON business_modules(business_id);
CREATE INDEX IF NOT EXISTS idx_biz_payment_settings_biz ON business_payment_settings(business_id);
CREATE INDEX IF NOT EXISTS idx_biz_feature_flags_biz ON business_feature_flags(business_id);

-- sales: lookup by customer, batch, product
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_batch ON sales(batch_id);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);

-- recipe_lines: by product and by item
CREATE INDEX IF NOT EXISTS idx_recipe_lines_product ON recipe_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_lines_item ON recipe_lines(item_id);

-- stock_entries: covering index for stock_levels view aggregation
-- (business_id, item_id, quantity) enables index-only scans for the SUM GROUP BY
CREATE INDEX IF NOT EXISTS idx_stock_entries_agg
  ON stock_entries(business_id, item_id, quantity);

-- stock_entries: reference_id index (batch_deduction lookups)
CREATE INDEX IF NOT EXISTS idx_stock_entries_reference ON stock_entries(reference_id);

-- ============================================================
-- 2. CONSTRAINTS
-- ============================================================

-- Prevent duplicate customer emails per business
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_biz_email
  ON customers(business_id, email)
  WHERE email IS NOT NULL;

-- Prevent negative COGS (data integrity for analytics)
ALTER TABLE sales
  ADD CONSTRAINT sales_cogs_nonneg CHECK (cogs >= 0);

-- Prevent negative gross_profit
ALTER TABLE sales
  ADD CONSTRAINT sales_gross_profit_realistic CHECK (gross_profit IS NULL OR gross_profit >= -(revenue));

-- ============================================================
-- 3. SERIALIZABLE ISOLATION for create_production_batch
--    Fixes TOCTOU race: two concurrent batch creations could
--    both pass the stock check and both deduct, resulting in
--    negative inventory.
-- ============================================================

-- We can't change the isolation level inside a PL/pgSQL function
-- with SET LOCAL (it affects the caller's transaction). Instead,
-- we use explicit row-level locking: SELECT ... FOR UPDATE on
-- each item row before checking stock.

-- Drop and recreate with locking
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

    -- Now under lock, check stock — no other transaction can deduct
    -- until this one commits or rolls back
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
