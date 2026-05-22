-- Little Town initial schema.
-- Apply locally with `bun run db:reset`, then push to hosted Supabase with `bun run db:push`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bingos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'complete', 'archived')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  board_size INTEGER NOT NULL DEFAULT 16 CHECK (board_size > 0),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bingo_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bingo_id UUID NOT NULL REFERENCES bingos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bingo_id, name)
);

CREATE TABLE IF NOT EXISTS bingo_board_tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bingo_id UUID NOT NULL REFERENCES bingos(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Kill Count', 'Experience', 'Drops')),
  task TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points >= 0),
  target_value INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bingo_id, position)
);

CREATE TABLE IF NOT EXISTS bingo_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bingo_id UUID NOT NULL REFERENCES bingos(id) ON DELETE CASCADE,
  tile_id UUID REFERENCES bingo_board_tiles(id) ON DELETE SET NULL,
  team_id UUID REFERENCES bingo_teams(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES users(id),
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS hiscore_cache (
  player_name TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bingos_status_idx ON bingos(status);
CREATE INDEX IF NOT EXISTS bingo_teams_bingo_idx ON bingo_teams(bingo_id);
CREATE INDEX IF NOT EXISTS bingo_board_tiles_bingo_idx ON bingo_board_tiles(bingo_id);
CREATE INDEX IF NOT EXISTS bingo_submissions_bingo_idx ON bingo_submissions(bingo_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_board_tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiscore_cache ENABLE ROW LEVEL SECURITY;

INSERT INTO users (username, email, password_hash, role)
VALUES
  ('admin', 'admin@littletown.local', 'dev:password', 'admin'),
  ('user', 'user@littletown.local', 'dev:password', 'user')
ON CONFLICT (username) DO NOTHING;
