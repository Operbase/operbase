-- Seed: default units
INSERT INTO units (name, type) VALUES
  ('gram',        'weight'),
  ('kilogram',    'weight'),
  ('pound',       'weight'),
  ('ounce',       'weight'),
  ('cup',         'volume'),
  ('tablespoon',  'volume'),
  ('teaspoon',    'volume'),
  ('litre',       'volume'),
  ('millilitre',  'volume'),
  ('piece',       'count'),
  ('dozen',       'count'),
  ('bag',         'count'),
  ('loaf',        'count'),
  ('pack',        'count'),
  ('roll',        'count')
ON CONFLICT (name) DO NOTHING;
