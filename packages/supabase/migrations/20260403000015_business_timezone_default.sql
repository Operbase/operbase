-- ============================================================
-- Business calendar: default IANA timezone for operators (WAT).
-- Canonical column: business_settings.timezone (per-tenant).
-- Timestamps elsewhere remain timestamptz (UTC).
-- ============================================================

ALTER TABLE business_settings
  ALTER COLUMN timezone SET DEFAULT 'Africa/Lagos';

UPDATE business_settings
SET timezone = 'Africa/Lagos'
WHERE timezone = 'UTC';

COMMENT ON COLUMN business_settings.timezone IS
  'IANA zone id for business-local calendar (today, greetings, aggregates).';
