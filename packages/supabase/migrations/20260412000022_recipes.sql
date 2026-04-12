-- ============================================================
-- Recipes
--
-- A recipe is a reusable ingredient template for a product
-- (or a specific variant of a product). When logging a production
-- run the owner picks a recipe, the system scales the ingredient
-- lines to the batch size, and pre-fills the production form.
--
-- Key design decisions:
--   - Multiple recipes per product are allowed (e.g. "standard",
--     "bulk version", "trial batch")
--   - variant_id is nullable — a recipe can be product-wide or
--     variant-specific
--   - yield_quantity is how many units the recipe makes as written;
--     the production form scales all quantities by
--     (units_to_produce / yield_quantity)
--   - batches.recipe_id records which recipe was used at run time
--     (nullable — not all runs use a saved recipe). This is the
--     link that powers cost-variance and trend insights.
--   - Recipe edits do NOT affect past batches — batch_items already
--     captures what was actually used. Recipe is a template only.
-- ============================================================

-- ── recipes ──────────────────────────────────────────────────
CREATE TABLE recipes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES businesses(id)  ON DELETE CASCADE,
  product_id      uuid        NOT NULL REFERENCES products(id)    ON DELETE CASCADE,
  variant_id      uuid                 REFERENCES product_variants(id) ON DELETE CASCADE,
  name            text        NOT NULL CHECK (trim(name) <> ''),
  yield_quantity  numeric     NOT NULL CHECK (yield_quantity > 0),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recipes_business_id_idx  ON recipes (business_id);
CREATE INDEX recipes_product_id_idx   ON recipes (product_id);
CREATE INDEX recipes_variant_id_idx   ON recipes (variant_id) WHERE variant_id IS NOT NULL;

-- ── recipe_items ─────────────────────────────────────────────
CREATE TABLE recipe_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid        NOT NULL REFERENCES recipes(id)   ON DELETE CASCADE,
  item_id     uuid        NOT NULL REFERENCES items(id)     ON DELETE CASCADE,
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quantity    numeric     NOT NULL CHECK (quantity > 0),  -- in the item's usage unit
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, item_id)
);

CREATE INDEX recipe_items_recipe_id_idx ON recipe_items (recipe_id);
CREATE INDEX recipe_items_item_id_idx   ON recipe_items (item_id);
CREATE INDEX recipe_items_business_id_idx ON recipe_items (business_id);

-- ── link batches → recipe used ───────────────────────────────
-- NULL = no recipe was used (manual entry or quick log)
ALTER TABLE batches
  ADD COLUMN recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;

CREATE INDEX batches_recipe_id_idx ON batches (recipe_id) WHERE recipe_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE recipes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes: business members only"
  ON recipes
  USING (
    business_id IN (
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "recipe_items: business members only"
  ON recipe_items
  USING (
    business_id IN (
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );

-- ── Insight view: expected cost per recipe at current prices ──
-- Computes what a single yield of each recipe costs today based on
-- items.avg_cost_per_usage_unit. Used for the margin simulator and
-- the expected-vs-actual insight.
CREATE OR REPLACE VIEW recipe_expected_costs AS
SELECT
  r.id                                                     AS recipe_id,
  r.business_id,
  r.product_id,
  r.variant_id,
  r.name                                                   AS recipe_name,
  r.yield_quantity,
  COALESCE(
    SUM(ri.quantity * COALESCE(i.avg_cost_per_usage_unit, i.cost_per_unit, 0)),
    0
  )                                                        AS expected_cost_per_yield,
  CASE
    WHEN r.yield_quantity > 0
    THEN COALESCE(
      SUM(ri.quantity * COALESCE(i.avg_cost_per_usage_unit, i.cost_per_unit, 0)),
      0
    ) / r.yield_quantity
    ELSE 0
  END                                                      AS expected_cost_per_unit,
  COUNT(ri.id)                                             AS ingredient_count
FROM recipes r
LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
LEFT JOIN items i         ON i.id = ri.item_id
GROUP BY r.id, r.business_id, r.product_id, r.variant_id, r.name, r.yield_quantity;

-- ── Insight view: cross-recipe ingredient dependency ─────────
-- For each item, how many distinct recipes use it?
-- High count = critical ingredient — if it runs out, many recipes are blocked.
CREATE OR REPLACE VIEW recipe_ingredient_dependency AS
SELECT
  ri.item_id,
  ri.business_id,
  i.name                       AS item_name,
  u.name                       AS usage_unit_name,
  COUNT(DISTINCT ri.recipe_id) AS recipe_count,
  ARRAY_AGG(DISTINCT r.name ORDER BY r.name) AS used_in_recipes
FROM recipe_items ri
JOIN items   i ON i.id = ri.item_id
JOIN recipes r ON r.id = ri.recipe_id
LEFT JOIN units u ON u.id = i.usage_unit_id
GROUP BY ri.item_id, ri.business_id, i.name, u.name;

-- ── Insight RPC: recipe cost variance per batch ───────────────
-- For batches that used a recipe, compares expected cost (recipe
-- at the prices prevailing when the batch was made — approximated
-- from batch_items lot allocations) vs actual cost stored on the batch.
-- Returns the last N batches for a given recipe so the UI can plot
-- a cost-trend line.
CREATE OR REPLACE FUNCTION recipe_batch_cost_trend(
  p_business_id uuid,
  p_recipe_id   uuid,
  p_limit       int DEFAULT 20
)
RETURNS TABLE (
  batch_id             uuid,
  produced_at          timestamptz,
  units_produced       numeric,
  actual_cost          numeric,     -- cost_of_goods from batches
  actual_cost_per_unit numeric,
  recipe_yield         numeric,
  scale_factor         numeric      -- units_produced / recipe yield_quantity
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id                                              AS batch_id,
    b.produced_at,
    b.units_produced,
    COALESCE(b.cost_of_goods, 0)                      AS actual_cost,
    CASE
      WHEN b.units_produced > 0
      THEN COALESCE(b.cost_of_goods, 0) / b.units_produced
      ELSE 0
    END                                               AS actual_cost_per_unit,
    r.yield_quantity                                  AS recipe_yield,
    CASE
      WHEN r.yield_quantity > 0
      THEN b.units_produced / r.yield_quantity
      ELSE 1
    END                                               AS scale_factor
  FROM batches b
  JOIN recipes r ON r.id = b.recipe_id
  WHERE b.business_id   = p_business_id
    AND b.recipe_id     = p_recipe_id
    AND b.cost_of_goods IS NOT NULL
  ORDER BY b.produced_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION recipe_batch_cost_trend(uuid, uuid, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION recipe_batch_cost_trend(uuid, uuid, int) TO authenticated;
