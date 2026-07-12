-- Automatic RSN-rename resolution via Wise Old Man (Sprint 6 follow-up to
-- 20260711143000_rsn_change_log.sql).
--
-- Until now, rsn_change_log was detection + logging only — a 404'd RSN sat
-- unresolved until an admin manually fixed it (services/rsnChangeDetection.ts
-- never touched bingo_players.rsn). This migration adds the columns
-- services/rsnChangeDetection.ts now needs to record an automatic
-- resolution:
--   - new_rsn: the RSN we auto-renamed to, when resolution = 'auto_wom'.
--     NULL for every other kind of resolution (a lookup on the original RSN
--     just started working again — resolveRsnChange's existing path — or a
--     future manual-fix path).
--   - resolution: how the row got resolved. NULL while unresolved.
--
-- It also extends rsn_change_log to cover side accounts
-- (bingo_player_side_accounts), which have had the exact same "RSN stopped
-- resolving" problem since side-account snapshots shipped
-- (services/sideAccountSnapshots.ts) but had nowhere to log it — see that
-- file's now-outdated top-of-file comment. Exactly one of player_id /
-- side_account_id must be set per row (the XOR check below); player_id was
-- NOT NULL before this migration, so it has to be relaxed here. Every
-- existing row has player_id set and side_account_id NULL, so the new CHECK
-- is satisfied by all current data — this migration never rewrites existing
-- rows, only adds columns/constraints.

ALTER TABLE rsn_change_log
  ALTER COLUMN player_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS side_account_id UUID
    REFERENCES bingo_player_side_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS new_rsn TEXT,
  ADD COLUMN IF NOT EXISTS resolution TEXT CHECK (resolution IN ('auto_wom', 'manual'));

-- Exactly one of player_id / side_account_id per row — same "which account
-- is this for" shape as bingo_player_hiscores' side_account_id (nullable,
-- arbitrated by partial unique indexes below) rather than a new pattern.
-- Validated against existing rows on creation (no NOT VALID) — safe because
-- every current row has player_id set / side_account_id NULL, per above.
ALTER TABLE rsn_change_log
  DROP CONSTRAINT IF EXISTS rsn_change_log_target_xor;
ALTER TABLE rsn_change_log
  ADD CONSTRAINT rsn_change_log_target_xor
    CHECK (
      (player_id IS NOT NULL AND side_account_id IS NULL) OR
      (player_id IS NULL AND side_account_id IS NOT NULL)
    );

-- The existing uq_rsn_change_log_unresolved_per_player index only covers
-- player_id — side accounts need their own "at most one unresolved row"
-- arbiter so services/rsnChangeDetection.ts's log-or-reuse logic can't
-- double-log a side account that keeps failing every tick.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rsn_change_log_unresolved_per_side_account
  ON rsn_change_log (side_account_id)
  WHERE resolved_at IS NULL;

-- Historical lookups by side account, mirroring rsn_change_log_player_idx.
CREATE INDEX IF NOT EXISTS rsn_change_log_side_account_idx
  ON rsn_change_log (side_account_id, detected_at DESC);
