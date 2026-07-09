-- Attribute bingo_submissions to a bingo_players row so per-player stats
-- (contract 3: GET /api/admin/bingo/player-stats) and /my-team-data drop
-- status (contract 5) can be computed without guessing from submitted_by
-- (a users FK, not a player FK -- see TEAM-BRIEF.md contract 5).

ALTER TABLE bingo_submissions
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES bingo_players(id) ON DELETE SET NULL;

COMMENT ON COLUMN bingo_submissions.player_id IS
  'bingo_players.id this submission is attributed to, set by the admin at '
  'approval time (POST .../screenshots/:id/approve, optional playerId). '
  'ON DELETE SET NULL so removing a player does not delete submission '
  'history. NULL for legacy/unattributed submissions.';

-- Query pattern this supports: GET /api/admin/bingo/player-stats aggregates
-- tilesCompleted/totalPoints/lastSeen per player from APPROVED submissions
-- only (contract 3), grouped by player_id. Partial + DESC on created_at so
-- both the GROUP BY aggregation and the "latest approved submission per
-- player" (lastSeen) lookup can use the same index. Expected volume is one
-- bingo event's worth of submissions at a time (tens to low hundreds of
-- players x board tiles) -- a single small index is enough, no per-player
-- query loop should ever be needed (see Story 2c: aggregate in SQL, no
-- N+1).
CREATE INDEX IF NOT EXISTS bingo_submissions_player_approved_idx
  ON bingo_submissions (player_id, created_at DESC)
  WHERE status = 'approved' AND player_id IS NOT NULL;
