-- ============================================================
-- Migration 00004: Analytics Events + Business Modules
-- ============================================================
-- Purpose:
--   1. analytics_events — append-only event log for Phase 1 telemetry.
--      Feeds Phase 6 intelligence layer. Lightweight: store action_type,
--      user, business, timestamp, and optional metadata jsonb.
--   2. business_modules — tracks which product modules a business has
--      enabled. Used to support multiple verticals (bakery, retail, etc.)
--      without changing the core schema. Phase 1 businesses default to
--      'inventory', 'production', 'sales' enabled.
-- ============================================================

-- ── 1. Analytics Events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text        NOT NULL,  -- e.g. 'item_created', 'batch_created'
  metadata    jsonb,                 -- optional: { item_id, batch_id, amount, ... }
  created_at  timestamptz DEFAULT now()
);

-- Index for querying by business + action over time
CREATE INDEX IF NOT EXISTS analytics_events_business_action_idx
  ON analytics_events (business_id, action_type, created_at DESC);

-- RLS: each business can only read its own events; writes via server-side service role
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_events_select ON analytics_events
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert their own events
CREATE POLICY analytics_events_insert ON analytics_events
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND business_id IN (
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );

-- ── 2. Business Modules ──────────────────────────────────────────────────────
-- Which modules a business has access to. Start all businesses with the
-- three Phase 1 modules enabled. Future verticals can add/remove modules
-- without schema changes.

CREATE TABLE IF NOT EXISTS business_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  module_key  text NOT NULL,  -- 'inventory' | 'production' | 'sales' | 'ecommerce' | ...
  is_enabled  boolean DEFAULT true,
  enabled_at  timestamptz DEFAULT now(),
  UNIQUE (business_id, module_key)
);

ALTER TABLE business_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_modules_select ON business_modules
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );

-- ── 3. Seed Phase 1 modules for existing businesses ─────────────────────────
-- Idempotent: ON CONFLICT DO NOTHING
INSERT INTO business_modules (business_id, module_key)
SELECT id, unnest(ARRAY['inventory', 'production', 'sales'])
FROM businesses
ON CONFLICT (business_id, module_key) DO NOTHING;

-- ── 4. Auto-seed modules when a business is created ─────────────────────────
-- Trigger so new businesses always start with Phase 1 modules enabled.
CREATE OR REPLACE FUNCTION seed_default_modules()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO business_modules (business_id, module_key)
  VALUES
    (NEW.id, 'inventory'),
    (NEW.id, 'production'),
    (NEW.id, 'sales')
  ON CONFLICT (business_id, module_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_business_created_seed_modules ON businesses;
CREATE TRIGGER on_business_created_seed_modules
  AFTER INSERT ON businesses
  FOR EACH ROW EXECUTE FUNCTION seed_default_modules();

-- ── 5. Grant permissions ─────────────────────────────────────────────────────
GRANT SELECT, INSERT ON analytics_events TO authenticated;
GRANT SELECT ON business_modules TO authenticated;
