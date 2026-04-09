-- Add common purchase/count units that are missing from the initial seed.
-- These are widely used in food businesses (bakeries, food prep, etc.).
INSERT INTO units (name, type) VALUES
  ('crate',   'count'),
  ('tray',    'count'),
  ('box',     'count'),
  ('bottle',  'volume'),
  ('jar',     'volume'),
  ('tin',     'count'),
  ('sachet',  'weight'),
  ('carton',  'count'),
  ('flat',    'count')
ON CONFLICT (name) DO NOTHING;
