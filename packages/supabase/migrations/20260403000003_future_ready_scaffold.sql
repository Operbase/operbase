-- ============================================================
-- Migration 00003: Future-ready scaffold
--
-- Closes gaps and lays the schema foundation for Phases 2–5
-- without building any UI. Every addition here is additive —
-- nothing breaks Phase 1.
--
-- Phase 1  (NOW)      — single business, owner only ✓
-- Phase 2  (next)     — multi-user RBAC inside a business
-- Phase 3  (later)    — multi-business SaaS, subdomains, branding
-- Phase 4  (later)    — payments (manual → gateway-ready)
-- Phase 5  (later)    — platform admin, feature flags, billing
-- ============================================================


-- ============================================================
-- SECURITY: make stock_levels respect RLS explicitly.
-- Default view security in Postgres 15+ is SECURITY INVOKER
-- (caller's permissions apply), but we set it explicitly so
-- the intent is clear and never depends on server defaults.
-- ============================================================
ALTER VIEW IF EXISTS stock_levels SET (security_invoker = on);


-- ============================================================
-- PERFORMANCE: indexes on hot query paths
-- ============================================================

-- stock_entries: summed for every stock_levels lookup and monthly spend
CREATE INDEX IF NOT EXISTS idx_stock_entries_item_id
  ON stock_entries(item_id);

CREATE INDEX IF NOT EXISTS idx_stock_entries_biz_created
  ON stock_entries(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_entries_biz_source
  ON stock_entries(business_id, source);

-- batch_items: scanned on batch create/delete and for COGS
CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id
  ON batch_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_items_item_id
  ON batch_items(item_id);

-- sales: date-range queries for revenue charts and dashboard
CREATE INDEX IF NOT EXISTS idx_sales_biz_sold_at
  ON sales(business_id, sold_at DESC);

-- items: filtered by type on stock page
CREATE INDEX IF NOT EXISTS idx_items_biz_type
  ON items(business_id, type);

-- batches: ordered by date on production page
CREATE INDEX IF NOT EXISTS idx_batches_biz_produced_at
  ON batches(business_id, produced_at DESC);

-- customers: searched by name
CREATE INDEX IF NOT EXISTS idx_customers_biz_name
  ON customers(business_id, name);


-- ============================================================
-- PHASE 2: Role-Based Access Control (RBAC)
-- Build this when a second user needs to log in to the same
-- business. Currently user_businesses.role is a plain text
-- column ('owner'). Phase 2 replaces that with this system.
-- ============================================================

-- Named roles per business (owner, manager, staff, or custom)
CREATE TABLE IF NOT EXISTS roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (business_id, name)
);

-- Atomic permission keys (e.g. 'stock:read', 'batch:create', 'sales:delete')
CREATE TABLE IF NOT EXISTS permissions (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key    text UNIQUE NOT NULL,
  label  text NOT NULL,
  module text NOT NULL  -- 'stock' | 'production' | 'sales' | 'admin'
);

-- Many-to-many: which permissions a role has
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Invites: send before the user has signed up
CREATE TABLE IF NOT EXISTS invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'staff',
  token       text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  accepted_at timestamptz,
  expires_at  timestamptz DEFAULT now() + INTERVAL '7 days',
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- Seed default permission keys (no-op if already exist)
INSERT INTO permissions (key, label, module) VALUES
  ('stock:read',        'View stock',           'stock'),
  ('stock:write',       'Add / edit stock',     'stock'),
  ('stock:delete',      'Delete stock items',   'stock'),
  ('batch:read',        'View batches',         'production'),
  ('batch:write',       'Create batches',       'production'),
  ('batch:delete',      'Delete batches',       'production'),
  ('sales:read',        'View sales',           'sales'),
  ('sales:write',       'Record sales',         'sales'),
  ('sales:delete',      'Delete sales',         'sales'),
  ('admin:settings',    'Business settings',    'admin'),
  ('admin:users',       'Manage team members',  'admin')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- PHASE 3: Business settings + multi-tenant extensions
-- ============================================================

-- Extend businesses with custom domain and plan tier
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE,
  ADD COLUMN IF NOT EXISTS plan         text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS is_active    boolean DEFAULT true;

COMMENT ON COLUMN businesses.plan IS 'free | starter | pro | enterprise';
COMMENT ON COLUMN businesses.custom_domain IS 'e.g. www.mybakery.com — set once verified';

-- Per-business settings (timezone, currency, locale)
CREATE TABLE IF NOT EXISTS business_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  timezone    text NOT NULL DEFAULT 'UTC',
  currency    text NOT NULL DEFAULT 'USD',
  locale      text NOT NULL DEFAULT 'en',
  updated_at  timestamptz DEFAULT now()
);


-- ============================================================
-- PHASE 4: Payment scaffold
-- Manual methods (cash, bank transfer) first.
-- Gateway (Stripe etc.) plugged in later per business.
-- ============================================================

-- Catalogue of payment methods (global, seeded)
CREATE TABLE IF NOT EXISTS payment_methods (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key       text UNIQUE NOT NULL,
  label     text NOT NULL,
  is_manual boolean DEFAULT true,   -- false = requires gateway config
  is_active boolean DEFAULT true
);

-- Which payment methods each business has enabled (+ gateway config)
CREATE TABLE IF NOT EXISTS business_payment_settings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid REFERENCES businesses(id) ON DELETE CASCADE,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE CASCADE,
  is_enabled        boolean DEFAULT false,
  config            jsonb DEFAULT '{}',  -- gateway API keys go via Vault in Phase 4
  created_at        timestamptz DEFAULT now(),
  UNIQUE (business_id, payment_method_id)
);

-- Seed manual payment methods
INSERT INTO payment_methods (key, label, is_manual) VALUES
  ('cash',          'Cash',                     true),
  ('bank_transfer', 'Bank Transfer',            true),
  ('invoice',       'Invoice (pay later)',       true),
  ('mobile_money',  'Mobile Money',             true)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- PHASE 5: Platform admin + feature flags
-- ============================================================

-- Users with platform-wide admin access (you)
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Feature flags catalogue
CREATE TABLE IF NOT EXISTS feature_flags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,
  label      text NOT NULL,
  default_on boolean DEFAULT false
);

-- Per-business flag overrides
CREATE TABLE IF NOT EXISTS business_feature_flags (
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  flag_id     uuid REFERENCES feature_flags(id) ON DELETE CASCADE,
  enabled     boolean DEFAULT false,
  PRIMARY KEY (business_id, flag_id)
);

-- Seed flags
INSERT INTO feature_flags (key, label, default_on) VALUES
  ('multi_user',        'Multiple team members',         false),
  ('ecommerce',         'Online ordering page',          false),
  ('payment_gateway',   'Payment gateway integration',   false),
  ('subscriptions',     'Recurring orders',              false),
  ('custom_domain',     'Custom domain',                 false),
  ('platform_reports',  'Platform-level analytics',      false)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- ROW LEVEL SECURITY on new tables
-- ============================================================

ALTER TABLE roles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods          ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_feature_flags   ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a platform admin?
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  );
$$;

-- Helper: does the user belong to a given business?
CREATE OR REPLACE FUNCTION user_in_business(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_businesses
    WHERE user_id = auth.uid() AND business_id = p_business_id
  );
$$;

-- Roles: business members can read; only owners can write (enforced in app for Phase 2)
CREATE POLICY tenant_isolation ON roles
  FOR ALL USING (business_id IN (
    SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
  ));

-- Permissions: read-only catalogue for all authenticated users
CREATE POLICY read_all ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Role permissions: same business scope as roles
CREATE POLICY tenant_isolation ON role_permissions
  FOR ALL USING (
    role_id IN (
      SELECT id FROM roles
      WHERE business_id IN (
        SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
      )
    )
  );

-- Invites: business members can see invites for their business
CREATE POLICY tenant_isolation ON invites
  FOR ALL USING (business_id IN (
    SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
  ));

-- Business settings: scoped to business members
CREATE POLICY tenant_isolation ON business_settings
  FOR ALL USING (business_id IN (
    SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
  ));

-- Payment methods: read-only catalogue
CREATE POLICY read_all ON payment_methods FOR SELECT USING (auth.uid() IS NOT NULL);

-- Business payment settings: scoped to business members
CREATE POLICY tenant_isolation ON business_payment_settings
  FOR ALL USING (business_id IN (
    SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
  ));

-- Platform admins: only platform admins can see this table
CREATE POLICY platform_only ON platform_admins
  FOR ALL USING (is_platform_admin());

-- Feature flags: read-only catalogue for authenticated users
CREATE POLICY read_all ON feature_flags FOR SELECT USING (auth.uid() IS NOT NULL);

-- Business feature flags: business members read; platform admins write
CREATE POLICY tenant_read ON business_feature_flags
  FOR SELECT USING (business_id IN (
    SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
  ));
CREATE POLICY platform_write ON business_feature_flags
  FOR ALL USING (is_platform_admin());

GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION user_in_business(uuid) TO authenticated;
