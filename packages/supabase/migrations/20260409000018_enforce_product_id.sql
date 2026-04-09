-- Enforce product_id on sales:
-- 1. For sales with product_name but NULL product_id, create products if needed and link them.
-- 2. Add NOT NULL constraint.

-- Step 1: For each distinct (business_id, product_name) combo in sales that has no product_id,
--         insert a product row if it doesn't already exist (case-insensitive match).
INSERT INTO products (business_id, name, sale_price, is_active)
SELECT DISTINCT
  s.business_id,
  -- Use the capitalisation from the most recent sale for that name
  (SELECT s2.product_name
   FROM sales s2
   WHERE s2.business_id = s.business_id
     AND lower(s2.product_name) = lower(s.product_name)
     AND s2.product_name IS NOT NULL
   ORDER BY s2.sold_at DESC
   LIMIT 1),
  0,          -- sale_price: unknown from text data; owner can update
  true
FROM sales s
WHERE s.product_id IS NULL
  AND s.product_name IS NOT NULL
  AND s.product_name <> ''
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.business_id = s.business_id
      AND lower(p.name) = lower(s.product_name)
  )
ON CONFLICT (business_id, name) DO NOTHING;

-- Step 2: Fill product_id on sales where it is NULL but product_name matches a product.
UPDATE sales s
SET product_id = p.id
FROM products p
WHERE s.product_id IS NULL
  AND s.business_id = p.business_id
  AND lower(s.product_name) = lower(p.name);

-- Step 3: For any remaining NULL rows (orphaned product_name with no business match),
--         create a catch-all product so NOT NULL is safe to add.
INSERT INTO products (business_id, name, sale_price, is_active)
SELECT DISTINCT s.business_id, 'Archived item', 0, false
FROM sales s
WHERE s.product_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.business_id = s.business_id AND p.name = 'Archived item'
  )
ON CONFLICT (business_id, name) DO NOTHING;

-- Fill any still-null rows with the catch-all product.
UPDATE sales s
SET product_id = p.id
FROM products p
WHERE s.product_id IS NULL
  AND s.business_id = p.business_id
  AND p.name = 'Archived item';

-- Step 4: Add NOT NULL constraint (should now be safe).
ALTER TABLE sales ALTER COLUMN product_id SET NOT NULL;

-- Step 5: Add a comment explaining the invariant.
COMMENT ON COLUMN sales.product_id IS
  'Required — every sale must be linked to a product. Set by record_sale_with_batch RPC.';
