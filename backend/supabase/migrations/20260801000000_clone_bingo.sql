-- clone_bingo: atomic "clone a board into a new draft" (TEAM-BRIEF.md
-- Sprint 17, Track A2, contract A3).
--
-- Copies board tiles only (position, type, task, points, target_value, AND
-- metadata -- see the deviation note below) from an existing bingo into a
-- brand-new 'draft' bingo. Never copies bingo_teams, bingo_players,
-- bingo_submissions, or any hiscore/snapshot data -- those all stay scoped
-- to the source bingo, matching every other table's ON DELETE CASCADE
-- relationship to bingos(id) (see the Sprint 17 data-engineer report's
-- cascade walk: a clone must not accidentally create a second live pointer
-- into another bingo's roster/history).
--
-- One Postgres function (rather than two round trips from the app) so the
-- "is there already an active bingo" check and the insert can't race a
-- concurrent activate_bingo() call the way two separate statements could --
-- same rationale as activate_bingo/replace_bingo_board in
-- 20260706000000_audit_fixes.sql.
--
-- Contract deviation flagged, not applied silently (TEAM-BRIEF.md rule:
-- report contract problems, don't unilaterally change them): the contract's
-- prose lists "task, type, points, targetValue, position" as the cloned
-- columns and does not mention `metadata`. `metadata` is not player/
-- instance data -- it's part of the tile's own definition (Board Builder's
-- boss/monster/activity picker reads it back via getBingoBoardById's
-- spread-then-override; see src/db/bingos.ts). Points and target_value are
-- themselves DERIVED from metadata at original save time
-- (saveActiveBingoBoard). Cloning the enumerated columns without metadata
-- would silently produce a round-2 board whose tiles show a KC/XP target
-- number with no boss/activity attached to it -- indistinguishable from the
-- B4 "autocomplete not clearing" data-entry hazard this same sprint is
-- fixing on the frontend. This migration copies metadata along with the
-- enumerated columns; it does not change tilesCloned's meaning or the
-- response shape, so the frozen contract itself is unaffected either way.
--
-- Reversible: DROP FUNCTION clone_bingo(uuid, text, timestamptz, timestamptz);
-- touches no existing table or row.
--
-- search_path pinned inline (public, pg_temp) from the start -- same fix as
-- 20260801000001_pin_function_search_paths.sql applies retroactively to the
-- 8 pre-existing functions the advisor flagged; no reason to ship a 9th
-- warning just to fix it in a follow-up migration.

CREATE OR REPLACE FUNCTION clone_bingo(
  p_source_bingo_id uuid,
  p_name text,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (id uuid, name text, status text, tiles_cloned integer)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id uuid;
  v_tiles_cloned integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bingos WHERE bingos.id = p_source_bingo_id) THEN
    RAISE EXCEPTION 'Source bingo not found';
  END IF;

  -- Mirrors uq_bingos_one_active's invariant explicitly: inserting a new
  -- 'draft' row can never trip that partial unique index itself (it only
  -- arbitrates status='active' rows), so the active-bingo refusal has to be
  -- a real pre-check here, not a caught 23505.
  IF EXISTS (SELECT 1 FROM bingos WHERE bingos.status = 'active') THEN
    RAISE EXCEPTION 'An active bingo already exists';
  END IF;

  INSERT INTO bingos (name, status, start_date, end_date, board_size)
  SELECT p_name, 'draft', p_start_date, p_end_date, b.board_size
  FROM bingos b
  WHERE b.id = p_source_bingo_id
  RETURNING bingos.id INTO v_new_id;

  INSERT INTO bingo_board_tiles (bingo_id, position, type, task, points, target_value, metadata)
  SELECT v_new_id, t.position, t.type, t.task, t.points, t.target_value, t.metadata
  FROM bingo_board_tiles t
  WHERE t.bingo_id = p_source_bingo_id;

  GET DIAGNOSTICS v_tiles_cloned = ROW_COUNT;

  RETURN QUERY
  SELECT b.id, b.name, b.status, v_tiles_cloned
  FROM bingos b
  WHERE b.id = v_new_id;
END;
$$;

-- Access: match 20260706000000_audit_fixes.sql / 20260709000000_snapshot_upsert_rpc.sql
-- conventions -- service_role only (belt-and-suspenders on top of the
-- ALTER DEFAULT PRIVILEGES grant from 20260707000000_service_role_grants.sql).
REVOKE ALL ON FUNCTION clone_bingo(uuid, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION clone_bingo(uuid, text, timestamptz, timestamptz)
  TO service_role;
