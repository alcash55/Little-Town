-- RSN change detection (TEAM-BRIEF.md Sprint 5, Track A item 1).
--
-- The stats cron and team drafter only ever validated an RSN at
-- registration. From here on, every hiscore lookup the backend makes for an
-- ALREADY-REGISTERED player (the snapshot cron, activation snapshots, the
-- admin-panel single/bulk refresh routes, retake-start-snapshots) also
-- checks whether that RSN still resolves. When it stops resolving (404 /
-- absent from the OSRS hiscores), we log it here rather than guessing at a
-- rename — detection + logging only, never an auto-rename of
-- bingo_players.rsn.
--
-- At most one UNRESOLVED row per player at a time: the partial unique index
-- below both backs the "does this player currently have a stale RSN, and
-- since when" query (player-stats' rsnStale/rsnStaleSince) and stops the
-- cron from inserting a fresh row on every 20-minute tick while the same RSN
-- stays broken. A hiscore lookup succeeding again for that RSN (e.g. the
-- player reverted the change) resolves the row automatically.

CREATE TABLE IF NOT EXISTS rsn_change_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES bingo_players(id) ON DELETE CASCADE,
  old_rsn       TEXT NOT NULL,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT NOT NULL CHECK (source IN ('cron', 'drafter')),
  resolved_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rsn_change_log_unresolved_per_player
  ON rsn_change_log (player_id)
  WHERE resolved_at IS NULL;

-- Historical lookups by player (admin UI could eventually show a full
-- history, not just the current unresolved flag).
CREATE INDEX IF NOT EXISTS rsn_change_log_player_idx
  ON rsn_change_log (player_id, detected_at DESC);

ALTER TABLE rsn_change_log ENABLE ROW LEVEL SECURITY;

-- Same "service_role only, explicit deny-all for anon/authenticated"
-- convention as 20260709000002_deny_all_rls_policies.sql.
DROP POLICY IF EXISTS rsn_change_log_deny_all ON rsn_change_log;
CREATE POLICY rsn_change_log_deny_all ON rsn_change_log FOR ALL TO anon, authenticated USING (false);
