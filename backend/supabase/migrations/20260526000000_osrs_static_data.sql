-- Static data cache for OSRS skills and activities scraped from the wiki.
-- The backend cron job upserts into this table once a day.

CREATE TABLE IF NOT EXISTS osrs_static_data (
  key TEXT PRIMARY KEY,           -- e.g. 'skills' or 'activities'
  data JSONB NOT NULL,            -- array of strings
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE osrs_static_data ENABLE ROW LEVEL SECURITY;

-- Insert empty placeholders so the cron job only ever needs to UPDATE
INSERT INTO osrs_static_data (key, data)
VALUES
  ('skills', '[]'::jsonb),
  ('activities', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
