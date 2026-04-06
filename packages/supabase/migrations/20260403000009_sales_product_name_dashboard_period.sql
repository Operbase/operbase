-- product_name: free-text "what was sold" for reporting (MVP; complements batch_id)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS product_name text;

COMMENT ON COLUMN sales.product_name IS 'What was sold (free text). Required for new sales in the app; nullable for legacy rows.';

-- Replace 1-arg metrics with 2-arg (second param optional) so sales can be filtered by period.
DROP FUNCTION IF EXISTS dashboard_metrics(uuid);

-- dashboard_metrics: optional sales window (NULL = all time). Batches/items counts stay all-time.
CREATE OR REPLACE FUNCTION dashboard_metrics(
  p_business_id uuid,
  p_sales_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_revenue    numeric,
  total_cogs       numeric,
  gross_profit     numeric,
  total_sales      bigint,
  total_batches    bigint,
  total_items      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT
    COALESCE(SUM(s.revenue), 0),
    COALESCE(SUM(s.cogs), 0),
    COALESCE(SUM(s.gross_profit), 0),
    COUNT(*)
  INTO total_revenue, total_cogs, gross_profit, total_sales
  FROM sales s
  WHERE s.business_id = p_business_id
    AND (p_sales_since IS NULL OR s.sold_at >= p_sales_since);

  SELECT COUNT(*) INTO total_batches
  FROM batches b
  WHERE b.business_id = p_business_id;

  SELECT COUNT(*) INTO total_items
  FROM items i
  WHERE i.business_id = p_business_id;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION dashboard_metrics(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dashboard_metrics(uuid, timestamptz) TO authenticated;
