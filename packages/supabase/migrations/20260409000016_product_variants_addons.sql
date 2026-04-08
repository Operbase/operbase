-- ============================================================
-- Product variants and add-ons
--
-- product_variants: named versions within a product
--   e.g. Banana Bread → Oat, Double Chocolate
--
-- product_addons: optional extras a customer can choose
--   e.g. Banana Bread → Nuts, Coconut, Chocolate
--
-- variant_id added (nullable) to batches and sales so each
-- production run and sale can be tagged to a specific variant.
-- Existing rows are unaffected (variant_id = NULL = no variant).
-- ============================================================

-- ------------------------------------------------------------
-- product_variants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_name_len   CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 200),
  CONSTRAINT product_variants_unique_name UNIQUE (product_id, name)
);

COMMENT ON TABLE  product_variants IS 'Named versions of a product (e.g. "Oat", "Double Chocolate"). Each variant can be linked to production runs and sales.';
COMMENT ON COLUMN product_variants.sort_order IS 'Display order within the parent product.';

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON product_variants
  FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- product_addons
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_addons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  extra_cost  numeric(12,4),          -- NULL = no fixed extra charge
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_addons_name_len    CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 200),
  CONSTRAINT product_addons_unique_name UNIQUE (product_id, name)
);

COMMENT ON TABLE  product_addons IS 'Optional extras/toppings a customer can add to a product (e.g. "Nuts", "Coconut").';
COMMENT ON COLUMN product_addons.extra_cost IS 'Optional additional cost for this add-on. NULL means no fixed charge.';

ALTER TABLE product_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON product_addons
  FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Add variant_id to batches and sales (nullable, backwards-compat)
-- ------------------------------------------------------------
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL;

COMMENT ON COLUMN batches.variant_id IS 'Which variant of the product was produced (NULL = no variant / base product).';
COMMENT ON COLUMN sales.variant_id   IS 'Which variant of the product was sold (NULL = no variant / base product).';
