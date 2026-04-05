-- ============================================================
-- RPC: create_business_with_owner
-- Creates a business, links the calling user as owner, and
-- seeds the business_settings row — all in one transaction.
-- SECURITY DEFINER lets us bypass RLS for the inserts.
-- ============================================================

CREATE OR REPLACE FUNCTION create_business_with_owner(
  p_name          text,
  p_subdomain     text,
  p_logo_url      text,
  p_brand_color   text,
  p_business_type text,
  p_currency      text DEFAULT 'USD'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_business_id uuid;
BEGIN
  -- Require an authenticated caller
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Bail if this user already owns a business (idempotency guard)
  IF EXISTS (
    SELECT 1 FROM user_businesses WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User already has a business';
  END IF;

  -- All three inserts in one transaction
  INSERT INTO businesses (name, subdomain, logo_url, brand_color, business_type)
  VALUES (p_name, p_subdomain, p_logo_url, p_brand_color, p_business_type)
  RETURNING id INTO v_business_id;

  INSERT INTO user_businesses (user_id, business_id, role)
  VALUES (v_user_id, v_business_id, 'owner');

  INSERT INTO business_settings (business_id, currency)
  VALUES (v_business_id, COALESCE(NULLIF(trim(p_currency), ''), 'USD'));

  RETURN v_business_id;
END;
$$;

-- Only authenticated users can call this function
REVOKE ALL ON FUNCTION create_business_with_owner(text, text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION create_business_with_owner(text, text, text, text, text, text) TO authenticated;
