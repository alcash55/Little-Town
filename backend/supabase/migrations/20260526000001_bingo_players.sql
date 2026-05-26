-- Player hiscore tracking for bingo events.
-- Each player is registered to a bingo with a RSN (RuneScape name).
-- Two snapshot types are stored per player per bingo:
--   'start'   - taken once when the player is registered, never overwritten
--   'current' - updated on demand throughout the bingo

CREATE TABLE IF NOT EXISTS bingo_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bingo_id      UUID NOT NULL REFERENCES bingos(id) ON DELETE CASCADE,
  team_id       UUID REFERENCES bingo_teams(id) ON DELETE SET NULL,
  rsn           TEXT NOT NULL,                         -- RuneScape name
  registered_by UUID REFERENCES users(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bingo_id, rsn)
);

CREATE TABLE IF NOT EXISTS bingo_player_snapshots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID NOT NULL REFERENCES bingo_players(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('start', 'current')),
  skills     JSONB NOT NULL DEFAULT '[]'::jsonb,
  activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, type)
);

CREATE INDEX IF NOT EXISTS bingo_players_bingo_idx    ON bingo_players(bingo_id);
CREATE INDEX IF NOT EXISTS bingo_players_team_idx     ON bingo_players(team_id);
CREATE INDEX IF NOT EXISTS bingo_snapshots_player_idx ON bingo_player_snapshots(player_id);

ALTER TABLE bingo_players          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_player_snapshots ENABLE ROW LEVEL SECURITY;
