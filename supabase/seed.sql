-- Renovation categories. Idempotent — safe to re-run.
insert into public.categories (slug, name, description, icon, sort_order) values
  ('kitchen',     'Kitchen Remodel',           'Full or partial kitchen renovation',                'utensils',     10),
  ('bathroom',    'Bathroom Remodel',          'Full or partial bathroom renovation',               'bath',         20),
  ('roofing',     'Roofing',                   'Roof repair, replacement, or new install',          'home',         30),
  ('flooring',    'Flooring',                  'Hardwood, tile, vinyl, carpet install or refinish', 'square',       40),
  ('painting',    'Interior / Exterior Paint', 'Painting projects of any size',                     'paint-bucket', 50),
  ('windows',     'Windows & Doors',           'Replacement, repair, or new install',               'door-open',    60),
  ('plumbing',    'Plumbing',                  'Repairs, fixtures, repipes, water heaters',         'droplets',     70),
  ('electrical',  'Electrical',                'Wiring, panels, lighting, EV chargers',             'plug',         80),
  ('hvac',        'HVAC',                      'Heating, cooling, ducts, mini-splits',              'wind',         90),
  ('addition',    'Addition / Extension',      'Adding square footage, second story, ADU',          'building-2',  100),
  ('basement',    'Basement Finishing',        'Full or partial basement build-outs',               'layers',      110),
  ('deck-patio',  'Deck & Patio',              'Outdoor living spaces, decks, pergolas',           'tree-pine',   120),
  ('landscaping', 'Landscaping',               'Yard work, hardscaping, irrigation',                'sprout',      130),
  ('siding',      'Siding',                    'Vinyl, fiber-cement, wood, stucco',                 'panels-top-left', 140),
  ('handyman',    'Handyman / Small Repairs',  'Small jobs under a few hundred dollars',            'wrench',      150)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order;
