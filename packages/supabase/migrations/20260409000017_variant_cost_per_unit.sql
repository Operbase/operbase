-- ============================================================
-- Add cost_per_unit to product_variants
--
-- Allows the owner to set a manual cost per unit for each
-- variant of a product (e.g. "Oat Banana Bread costs ₦180 to make").
--
-- NULL = no manual cost set → system falls back to batch WAC.
-- NOT NULL = this cost is used directly when logging sales of
--            this variant (overrides the weighted-average lookup).
--
-- This keeps the cost model simple:
--   1. Owner sets cost per type on the Products page
--   2. Sale profit = (price × units) − (cost × units)
--   3. No need to link every sale to a production batch
-- ============================================================

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cost_per_unit numeric(12, 4);

COMMENT ON COLUMN product_variants.cost_per_unit IS
  'Manual cost to produce or source one unit of this variant. '
  'NULL = fall back to batch weighted-average cost (WAC). '
  'Set by the owner on the Products page.';
