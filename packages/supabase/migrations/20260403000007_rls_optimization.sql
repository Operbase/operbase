-- ============================================================
-- Migration 00007: RLS optimization for multi-tenant scale
--
-- Problem: Every table access triggers a subquery:
--   WHERE business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
--
-- For recipe_lines/batch_items it's even worse (3-level nesting).
--
-- Solution: Replace with EXISTS pattern using the existing
-- user_in_business() SECURITY DEFINER function. Postgres can
-- optimize this into a single indexed lookup per query.
-- ============================================================

-- Enable pg_trgm for text search indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================

-- ============================================================
-- Replace single-level tenant isolation policies with EXISTS
-- ============================================================

DROP POLICY IF EXISTS tenant_isolation ON items;
DROP POLICY IF EXISTS tenant_isolation ON stock_entries;
DROP POLICY IF EXISTS tenant_isolation ON products;
DROP POLICY IF EXISTS tenant_isolation ON batches;
DROP POLICY IF EXISTS tenant_isolation ON customers;
DROP POLICY IF EXISTS tenant_isolation ON subscriptions;
DROP POLICY IF EXISTS tenant_isolation ON sales;
DROP POLICY IF EXISTS tenant_isolation ON businesses;

-- Use EXISTS with the SECURITY DEFINER function (cached per query)
CREATE POLICY tenant_isolation ON items
  FOR ALL USING (user_in_business(business_id));

CREATE POLICY tenant_isolation ON stock_entries
  FOR ALL USING (user_in_business(business_id));

CREATE POLICY tenant_isolation ON products
  FOR ALL USING (user_in_business(business_id));

CREATE POLICY tenant_isolation ON batches
  FOR ALL USING (user_in_business(business_id));

CREATE POLICY tenant_isolation ON customers
  FOR ALL USING (user_in_business(business_id));

CREATE POLICY tenant_isolation ON subscriptions
  FOR ALL USING (user_in_business(business_id));

CREATE POLICY tenant_isolation ON sales
  FOR ALL USING (user_in_business(business_id));

CREATE POLICY tenant_isolation ON businesses
  FOR ALL USING (id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));

-- ============================================================
-- Replace nested subquery policies (recipe_lines, batch_items)
-- by adding business_id denormalization for direct scoping
-- ============================================================

-- Add business_id to recipe_lines (denormalize for RLS + query speed)
ALTER TABLE recipe_lines
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;

-- Backfill existing recipe_lines
UPDATE recipe_lines rl
SET business_id = p.business_id
FROM products p
WHERE rl.product_id = p.id AND rl.business_id IS NULL;

-- Add business_id to batch_items (same reason)
ALTER TABLE batch_items
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;

-- Backfill existing batch_items
UPDATE batch_items bi
SET business_id = b.business_id
FROM batches b
WHERE bi.batch_id = b.id AND bi.business_id IS NULL;

-- Index for the new columns
CREATE INDEX IF NOT EXISTS idx_recipe_lines_biz ON recipe_lines(business_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_biz ON batch_items(business_id);

-- Replace nested policies with direct EXISTS
DROP POLICY IF EXISTS tenant_isolation ON recipe_lines;
DROP POLICY IF EXISTS tenant_isolation ON batch_items;

CREATE POLICY tenant_isolation ON recipe_lines
  FOR ALL USING (user_in_business(business_id));

CREATE POLICY tenant_isolation ON batch_items
  FOR ALL USING (user_in_business(business_id));

-- Add indexes for text search on hot paths
-- ============================================================

-- items.name search (stock page search input)
CREATE INDEX IF NOT EXISTS idx_items_name ON items USING gin (name gin_trgm_ops);

-- customers.name search (sales page search)
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING gin (name gin_trgm_ops);
