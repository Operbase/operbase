-- ============================================================
-- Migration 00006: Server-side aggregation RPCs for dashboard
--
-- Eliminates full-table client-side fetches. The dashboard
-- now calls one RPC instead of transferring all rows to the
-- browser for JavaScript aggregation.
-- ============================================================

-- ============================================================
-- dashboard_metrics: one-call summary for the dashboard home
-- Returns revenue, COGS, gross profit, counts, and spend rows
-- ============================================================
CREATE OR REPLACE FUNCTION dashboard_metrics(
  p_business_id uuid
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
  WHERE s.business_id = p_business_id;

  SELECT COUNT(*) INTO total_batches
  FROM batches b
  WHERE b.business_id = p_business_id;

  SELECT COUNT(*) INTO total_items
  FROM items i
  WHERE i.business_id = p_business_id;
END;
$$;

REVOKE ALL ON FUNCTION dashboard_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dashboard_metrics(uuid) TO authenticated;

-- ============================================================
-- low_stock_alerts: server-side filtering of low/out-of-stock
-- Returns only items that are out of stock or below threshold.
-- Limited to p_limit rows (default 12).
-- ============================================================
CREATE OR REPLACE FUNCTION low_stock_alerts(
  p_business_id uuid,
  p_limit int DEFAULT 12
)
RETURNS TABLE (
  item_id          uuid,
  item_name        text,
  quantity_on_hand numeric,
  usage_unit_name  text,
  threshold        numeric,
  reason           text
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

  RETURN QUERY
  SELECT
    i.id,
    i.name::text,
    sl.quantity_on_hand,
    uu.name::text,
    i.low_stock_threshold,
    CASE
      WHEN sl.quantity_on_hand <= 0 THEN 'Out of stock'
      ELSE 'At or below threshold (' || i.low_stock_threshold::text || ')'
    END
  FROM items i
  JOIN stock_levels sl ON sl.item_id = i.id
  LEFT JOIN units uu ON uu.id = i.usage_unit_id
  WHERE i.business_id = p_business_id
    AND (
      sl.quantity_on_hand <= 0
      OR (i.low_stock_threshold IS NOT NULL AND sl.quantity_on_hand <= i.low_stock_threshold)
    )
  ORDER BY
    CASE WHEN sl.quantity_on_hand <= 0 THEN 0 ELSE 1 END,
    sl.quantity_on_hand ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION low_stock_alerts(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION low_stock_alerts(uuid, int) TO authenticated;
