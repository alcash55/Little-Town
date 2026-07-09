-- Snapshot upsert RPCs: replace the two PostgREST .upsert() call sites in
-- backend/src/db/players.ts (savePlayerSnapshot's "start"/"current" paths,
-- currently ~line 207/227) with SQL that can target the correct partial
-- unique index, then retire the stale full-table constraint that was
-- papering over the gap.
--
-- Background:
-- uq_hiscores_primary (player_id, type) WHERE side_account_id IS NULL and
-- uq_hiscores_side (side_account_id, type) WHERE side_account_id IS NOT
-- NULL (both from 20260601000000_side_accounts.sql) are PARTIAL unique
-- indexes. Postgres will only use a partial index as an ON CONFLICT arbiter
-- when the ON CONFLICT clause repeats that index's WHERE predicate
-- (`ON CONFLICT (cols) WHERE <predicate>`) -- and PostgREST's upsert()
-- `onConflict` option only ever emits a bare column list, never a
-- predicate. So today's two upsert() calls only work at all because a
-- *stale* non-partial UNIQUE constraint, bingo_player_snapshots_player_id
-- _type_key, still exists on (player_id, type) with no predicate.
--
-- That constraint predates side accounts: it was created by
-- 20260526000001_bingo_players.sql as the implicit UNIQUE (player_id, type)
-- constraint on the table then named bingo_player_snapshots.
-- 20260526000002_rename_snapshots.sql renamed the table to
-- bingo_player_hiscores, but Postgres does NOT rename constraints when
-- their owning table is renamed, so the constraint kept its original,
-- now-misleading name. 20260601000000_side_accounts.sql tried to drop it
-- as part of switching to the two partial indexes above, but the DROP
-- CONSTRAINT there used the *post-rename* guessed name
-- (bingo_player_hiscores_player_id_type_key), which never existed --
-- `DROP CONSTRAINT IF EXISTS` silently no-op'd, and the real, still-named
-- bingo_player_snapshots_player_id_type_key constraint was left in place.
--
-- Net effect: that leftover constraint enforces (player_id, type)
-- uniqueness across ALL rows regardless of side_account_id, which is
-- exactly the primary-account behavior we want, but it also *rejects* any
-- side-account snapshot that shares a player_id+type with that player's
-- primary snapshot -- even though uq_hiscores_side would happily allow it
-- alongside the primary row. Side-account hiscore snapshots have been
-- unstorable since 20260601000000 shipped.
--
-- Fix, in this order (see the drop at the bottom of this file):
--   1. Create upsert_player_hiscore_start / upsert_player_hiscore_current,
--      which branch in SQL on whether p_side_account_id is NULL and target
--      the matching partial index as the ON CONFLICT arbiter.
--   2. Only once those RPCs exist (the only remaining writers with a legal
--      arbiter for either case) drop the stale constraint. Until step 1
--      lands, dropping the constraint first would leave a window where
--      concurrent primary-account "start"/"current" saves via the old
--      PostgREST upsert() calls have NO working arbiter at all and start
--      throwing 42P10 (no unique or exclusion constraint matching the ON
--      CONFLICT specification).

-- ---------------------------------------------------------------------------
-- upsert_player_hiscore_start: insert-if-absent. Mirrors the current
-- ignoreDuplicates:true call site -- a start snapshot is taken once at
-- registration/activation and must never be overwritten by a later call,
-- even under concurrent registration races. On conflict we re-assign
-- taken_at to its own current value (a no-op write) purely so RETURNING
-- always yields the existing row -- the caller gets "whichever row exists"
-- in a single round trip instead of upsert-then-reselect.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_player_hiscore_start(
  p_player_id uuid,
  p_side_account_id uuid,
  p_skills jsonb,
  p_activities jsonb,
  p_taken_at timestamptz
)
RETURNS bingo_player_hiscores
LANGUAGE plpgsql
AS $$
DECLARE
  v_row bingo_player_hiscores;
BEGIN
  IF p_side_account_id IS NULL THEN
    INSERT INTO bingo_player_hiscores (player_id, side_account_id, type, skills, activities, taken_at)
    VALUES (p_player_id, NULL, 'start', p_skills, p_activities, p_taken_at)
    ON CONFLICT (player_id, type) WHERE side_account_id IS NULL
    DO UPDATE SET taken_at = bingo_player_hiscores.taken_at -- no-op: never overwrite an existing start snapshot
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO bingo_player_hiscores (player_id, side_account_id, type, skills, activities, taken_at)
    VALUES (p_player_id, p_side_account_id, 'start', p_skills, p_activities, p_taken_at)
    ON CONFLICT (side_account_id, type) WHERE side_account_id IS NOT NULL
    DO UPDATE SET taken_at = bingo_player_hiscores.taken_at -- no-op, same as above
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- upsert_player_hiscore_current: always-overwrite upsert. Mirrors the
-- current plain upsert() call site -- a "current" snapshot is refreshed on
-- demand throughout the bingo and always reflects the latest fetch.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_player_hiscore_current(
  p_player_id uuid,
  p_side_account_id uuid,
  p_skills jsonb,
  p_activities jsonb,
  p_taken_at timestamptz
)
RETURNS bingo_player_hiscores
LANGUAGE plpgsql
AS $$
DECLARE
  v_row bingo_player_hiscores;
BEGIN
  IF p_side_account_id IS NULL THEN
    INSERT INTO bingo_player_hiscores (player_id, side_account_id, type, skills, activities, taken_at)
    VALUES (p_player_id, NULL, 'current', p_skills, p_activities, p_taken_at)
    ON CONFLICT (player_id, type) WHERE side_account_id IS NULL
    DO UPDATE SET skills = EXCLUDED.skills, activities = EXCLUDED.activities, taken_at = EXCLUDED.taken_at
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO bingo_player_hiscores (player_id, side_account_id, type, skills, activities, taken_at)
    VALUES (p_player_id, p_side_account_id, 'current', p_skills, p_activities, p_taken_at)
    ON CONFLICT (side_account_id, type) WHERE side_account_id IS NOT NULL
    DO UPDATE SET skills = EXCLUDED.skills, activities = EXCLUDED.activities, taken_at = EXCLUDED.taken_at
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Access: match 20260706000000_audit_fixes.sql / 20260707000000_service_role
-- _grants.sql conventions -- service_role only. 20260707000000 also sets
-- ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO service_role
-- for functions created by the `postgres` role after it ran, which covers
-- these two automatically; the explicit GRANT below is kept for the same
-- belt-and-suspenders reason 20260706000000 explicitly REVOKEs even though
-- anon/authenticated are already locked out repo-wide.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION upsert_player_hiscore_start(uuid, uuid, jsonb, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION upsert_player_hiscore_current(uuid, uuid, jsonb, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_player_hiscore_start(uuid, uuid, jsonb, jsonb, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION upsert_player_hiscore_current(uuid, uuid, jsonb, jsonb, timestamptz)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Drop the stale constraint. Must run AFTER both RPCs above exist (see the
-- header comment) -- players.ts is switched to call the RPCs in this same
-- sprint, so by the time this migration is applied nothing depends on the
-- old constraint as an ON CONFLICT arbiter any more.
--
-- Rollback note (flagging per data-eng convention, even though this is a
-- constraint, not data): if this needs to be reverted, re-running
--   ALTER TABLE bingo_player_hiscores
--     ADD CONSTRAINT bingo_player_snapshots_player_id_type_key UNIQUE (player_id, type);
-- will fail if any side-account row has been inserted in the meantime
-- (duplicate player_id+type across a primary/side pair) -- that data loss
-- risk is exactly why side-account snapshots were unstorable before this
-- migration, so it is inherent to going back, not introduced by going
-- forward. No existing rows are deleted or modified by this migration.
-- ---------------------------------------------------------------------------
ALTER TABLE bingo_player_hiscores
  DROP CONSTRAINT IF EXISTS bingo_player_snapshots_player_id_type_key;
