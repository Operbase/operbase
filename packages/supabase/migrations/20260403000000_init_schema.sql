-- ============================================================
-- Operbase Initial Schema
-- ============================================================

-- Units & Conversions (shared, global)
CREATE TABLE IF NOT EXISTS units (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  type text NOT NULL  -- 'weight' | 'volume' | 'count'
);

CREATE TABLE IF NOT EXISTS unit_conversions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit uuid REFERENCES units(id),
  to_unit   uuid REFERENCES units(id),
  factor    numeric(18,6) NOT NULL,
  UNIQUE (from_unit, to_unit)
);

-- Businesses (tenants)
CREATE TABLE IF NOT EXISTS businesses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  logo_url      text,
  brand_color   text DEFAULT '#000000',
  subdomain     text UNIQUE NOT NULL,
  business_type text NOT NULL DEFAULT 'bakery',
  created_at    timestamptz DEFAULT now()
);

-- User <-> Business relationship
CREATE TABLE IF NOT EXISTS user_businesses (
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'owner',  -- owner | manager | staff
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

-- Items (ingredients + packaging)
-- cost_per_unit = price per purchase unit; stock_entries.quantity = usage units;
-- conversion_ratio = usage units per one purchase unit (e.g. 25 kg per bag).
CREATE TABLE IF NOT EXISTS items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name                text NOT NULL,
  type                text NOT NULL,  -- 'ingredient' | 'packaging'
  unit_id             uuid REFERENCES units(id),
  purchase_unit_id    uuid REFERENCES units(id) ON DELETE SET NULL,
  usage_unit_id       uuid REFERENCES units(id) ON DELETE SET NULL,
  conversion_ratio    numeric(18, 6) NOT NULL DEFAULT 1
    CHECK (conversion_ratio > 0),
  low_stock_threshold numeric(12, 4),
  cost_per_unit       numeric(12,4) NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (business_id, name)
);

-- Stock ledger (append-only)
CREATE TABLE IF NOT EXISTS stock_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES businesses(id) ON DELETE CASCADE,
  item_id       uuid REFERENCES items(id) ON DELETE CASCADE,
  quantity      numeric(12,4) NOT NULL,  -- positive = restock, negative = deduction
  cost_per_unit numeric(12,4),
  source        text DEFAULT 'manual',   -- 'purchase' | 'batch_deduction' | 'batch_reversal' | 'adjustment'
  reference_id  uuid,                    -- points to batch_id when source = 'batch_deduction'
  note          text,
  created_at    timestamptz DEFAULT now()
);

-- Current stock level per item (computed view)
CREATE OR REPLACE VIEW stock_levels AS
  SELECT item_id, business_id, SUM(quantity) AS quantity_on_hand
  FROM stock_entries
  GROUP BY item_id, business_id;

-- Products
CREATE TABLE IF NOT EXISTS products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  unit_id     uuid REFERENCES units(id),
  sale_price  numeric(12,4) NOT NULL DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (business_id, name)
);

-- Recipe lines (ingredients per product)
CREATE TABLE IF NOT EXISTS recipe_lines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  item_id    uuid REFERENCES items(id),
  quantity   numeric(12,4) NOT NULL,
  unit_id    uuid REFERENCES units(id)
);

-- Production batches
CREATE TABLE IF NOT EXISTS batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id),
  units_produced  numeric(12,4) NOT NULL,
  units_remaining numeric(12,4) NOT NULL,
  cost_of_goods   numeric(12,4),
  notes           text,
  produced_at     timestamptz DEFAULT now()
);

-- Items consumed per batch (cost snapshot)
CREATE TABLE IF NOT EXISTS batch_items (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  item_id  uuid REFERENCES items(id),
  quantity numeric(12,4) NOT NULL,
  unit_id  uuid REFERENCES units(id),
  cost     numeric(12,4) NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- Recurring orders
CREATE TABLE IF NOT EXISTS subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id),
  quantity    numeric(12,4) NOT NULL,
  frequency   text NOT NULL,  -- 'daily' | 'weekly' | 'monthly'
  next_due    date NOT NULL,
  unit_price  numeric(12,4) NOT NULL,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES customers(id) ON DELETE SET NULL,
  batch_id     uuid REFERENCES batches(id) ON DELETE SET NULL,
  product_id   uuid REFERENCES products(id),
  units_sold   numeric(12,4) NOT NULL,
  unit_price   numeric(12,4) NOT NULL,
  revenue      numeric(12,4) GENERATED ALWAYS AS (units_sold * unit_price) STORED,
  cogs         numeric(12,4),
  gross_profit numeric(12,4) GENERATED ALWAYS AS (units_sold * unit_price - COALESCE(cogs, 0)) STORED,
  sold_at      timestamptz DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE businesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE units           ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_isolation ON businesses      FOR ALL USING (id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));
CREATE POLICY tenant_isolation ON user_businesses FOR ALL USING (user_id = auth.uid());
CREATE POLICY tenant_isolation ON items           FOR ALL USING (business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));
CREATE POLICY tenant_isolation ON stock_entries   FOR ALL USING (business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));
CREATE POLICY tenant_isolation ON products        FOR ALL USING (business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));
CREATE POLICY tenant_isolation ON batches         FOR ALL USING (business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));
CREATE POLICY tenant_isolation ON customers       FOR ALL USING (business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));
CREATE POLICY tenant_isolation ON subscriptions   FOR ALL USING (business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));
CREATE POLICY tenant_isolation ON sales           FOR ALL USING (business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid()));
CREATE POLICY tenant_isolation ON recipe_lines    FOR ALL USING (product_id IN (SELECT id FROM products WHERE business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())));
CREATE POLICY tenant_isolation ON batch_items     FOR ALL USING (batch_id IN (SELECT id FROM batches WHERE business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())));

-- Shared lookup tables: read-only for all authenticated users
CREATE POLICY read_only ON units            FOR SELECT USING (true);
CREATE POLICY read_only ON unit_conversions FOR SELECT USING (true);
