-- Team captain: one player per team can be designated captain for draft auto-placement.

ALTER TABLE bingo_players
  ADD COLUMN IF NOT EXISTS captain_team_id UUID REFERENCES bingo_teams(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bingo_players_one_captain_per_team
  ON bingo_players (captain_team_id)
  WHERE captain_team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bingo_players_captain_team_idx
  ON bingo_players (captain_team_id);
