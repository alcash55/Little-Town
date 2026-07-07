-- Audit fix sprint: atomic RPCs for board/team replacement, captain
-- assignment, and bingo activation, plus a partial unique index enforcing
-- at most one active bingo at a time.
--
-- All functions run under the service_role key (see
-- 20260525000000_revoke_public_access.sql); they are created without
-- SECURITY DEFINER so they execute with the caller's (service_role)
-- privileges, and EXECUTE is revoked from anon/authenticated to match the
-- existing "no direct access outside service_role" convention.

-- ---------------------------------------------------------------------------
-- At most one active bingo at a time.
-- A second concurrent activation will now fail with a unique_violation
-- (23505) instead of silently creating two active bingos.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_bingos_one_active
  ON bingos ((true))
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- replace_bingo_board: atomically replace all board tiles for a bingo.
-- p_tiles: jsonb array of
--   {position int, type text, task text, points int, target_value int|null, metadata jsonb}
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION replace_bingo_board(p_bingo_id uuid, p_tiles jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM bingo_board_tiles WHERE bingo_id = p_bingo_id;

  INSERT INTO bingo_board_tiles
    (bingo_id, position, type, task, points, target_value, metadata)
  SELECT
    p_bingo_id,
    (tile->>'position')::int,
    tile->>'type',
    tile->>'task',
    (tile->>'points')::int,
    NULLIF(tile->>'target_value', '')::int,
    COALESCE(tile->'metadata', '{}'::jsonb)
  FROM jsonb_array_elements(p_tiles) AS tile;
END;
$$;

-- ---------------------------------------------------------------------------
-- replace_bingo_teams: atomically replace the team list for a bingo.
-- Teams whose name matches an existing team keep their id (so
-- bingo_players.team_id / captain_team_id assignments survive). Removed
-- teams are deleted; both bingo_players.team_id and captain_team_id are
-- ON DELETE SET NULL against bingo_teams(id) (see
-- 20260522000000_initial_schema.sql / 20260602000000_bingo_player_captain.sql),
-- so deleting a team automatically nulls out those columns for its
-- players without any extra UPDATE. New names are inserted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION replace_bingo_teams(p_bingo_id uuid, p_team_names text[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove teams that are no longer present. bingo_players.team_id and
  -- captain_team_id are ON DELETE SET NULL, so this cannot violate any FK.
  DELETE FROM bingo_teams
  WHERE bingo_id = p_bingo_id
    AND (p_team_names IS NULL OR NOT (name = ANY (p_team_names)));

  -- Insert names that don't already exist for this bingo; existing rows
  -- (matched by the UNIQUE (bingo_id, name) constraint) keep their id.
  INSERT INTO bingo_teams (bingo_id, name, sort_order)
  SELECT p_bingo_id, t.name, t.ord - 1
  FROM unnest(COALESCE(p_team_names, ARRAY[]::text[])) WITH ORDINALITY AS t(name, ord)
  ON CONFLICT (bingo_id, name) DO UPDATE
    SET sort_order = EXCLUDED.sort_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- set_team_captain: atomically clear the current captain of the team and
-- set the new one. p_captain_team_id NULL clears this player's captaincy.
-- Raises an exception if the player or team is not found in this bingo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_team_captain(
  p_bingo_id uuid,
  p_rsn text,
  p_captain_team_id uuid
)
RETURNS SETOF bingo_players
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bingo_players WHERE bingo_id = p_bingo_id AND rsn = p_rsn
  ) THEN
    RAISE EXCEPTION 'Player "%" not found in this bingo', p_rsn;
  END IF;

  IF p_captain_team_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM bingo_teams WHERE id = p_captain_team_id AND bingo_id = p_bingo_id
    ) THEN
      RAISE EXCEPTION 'Captain team not found for this bingo';
    END IF;

    -- Clear any existing captain of this team first so the
    -- uq_bingo_players_one_captain_per_team partial unique index is never
    -- violated mid-flight.
    UPDATE bingo_players
    SET captain_team_id = NULL
    WHERE bingo_id = p_bingo_id
      AND captain_team_id = p_captain_team_id;
  END IF;

  RETURN QUERY
  UPDATE bingo_players
  SET captain_team_id = p_captain_team_id
  WHERE bingo_id = p_bingo_id
    AND rsn = p_rsn
  RETURNING *;
END;
$$;

-- ---------------------------------------------------------------------------
-- activate_bingo: single conditional UPDATE, draft -> active. Returns true
-- if this call performed the transition, false if the bingo was already
-- active / not a draft (or does not exist), OR if it lost the race against
-- uq_bingos_one_active (another bingo is already active) -- that unique
-- violation is caught and treated the same as "did not transition" rather
-- than propagating as an error, per the backend contract addendum.
-- start_date is set to COALESCE(start_date, now()) so an already-scheduled
-- start_date is kept.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_bingo(p_bingo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE bingos
  SET status = 'active',
      start_date = COALESCE(start_date, now()),
      updated_at = now()
  WHERE id = p_bingo_id
    AND status = 'draft';

  v_updated := FOUND;
  RETURN v_updated;
EXCEPTION
  WHEN unique_violation THEN
    -- Another bingo is already active (uq_bingos_one_active); this call
    -- did not perform the transition.
    RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- Access: match 20260525000000_revoke_public_access.sql convention (the
-- backend only ever talks to Postgres via the service_role key).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION replace_bingo_board(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION replace_bingo_teams(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_team_captain(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION activate_bingo(uuid) FROM PUBLIC, anon, authenticated;
