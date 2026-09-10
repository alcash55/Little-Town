-- #47: bingo_players.UNIQUE(bingo_id, rsn) is case-sensitive today, so
-- "Zezima" and "zezima" can both register in the same bingo. The app works
-- around it with an ILIKE lookup (findBingoPlayerCaseInsensitive in
-- backend/src/db/players.ts) before insert, which only helps callers that
-- remember to use it. Moving the constraint itself to citext makes every
-- comparison against rsn case-insensitive, including plain .eq() calls, and
-- makes the app-level workaround provably redundant rather than just
-- unnecessary in the common case.
--
-- Non-destructive / reversible: only changes a column's comparison type and
-- adds a table comment. No rows are read destructively, updated, or deleted.
-- To reverse: ALTER TABLE bingo_players ALTER COLUMN rsn TYPE TEXT;
-- COMMENT ON TABLE bingo_player_hiscore_history IS NULL; — the citext
-- extension is left installed since dropping it is a separate, unrelated
-- decision and citext costs nothing to leave enabled.

CREATE EXTENSION IF NOT EXISTS citext;

-- Guard: once rsn is citext, the existing UNIQUE (bingo_id, rsn) index is
-- rebuilt case-insensitively, and two rows differing only by casing collide.
-- If that's already true of real data, the bare ALTER below fails with an
-- unreadable unique-violation on a row it doesn't name. List the offenders
-- instead so whoever hits this knows what to merge or rename by hand before
-- retrying, rather than restoring a backup by reflex.
DO $$
DECLARE
  dupes TEXT;
BEGIN
  SELECT string_agg(
    format('bingo_id=%s rsn(lower)=%s (%s rows)', bingo_id, rsn_lower, row_count),
    '; '
  )
  INTO dupes
  FROM (
    SELECT bingo_id, lower(rsn) AS rsn_lower, count(*) AS row_count
    FROM bingo_players
    GROUP BY bingo_id, lower(rsn)
    HAVING count(*) > 1
  ) collisions;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'bingo_players has case-variant RSN duplicates that must be resolved by hand before this migration can run: %',
      dupes;
  END IF;
END $$;

ALTER TABLE bingo_players
  ALTER COLUMN rsn TYPE CITEXT;

-- bingo_player_hiscore_history retention: append-only, no delete/purge path
-- exists yet (see 20260711000000_hiscore_conflict_history.sql). This sprint
-- is the table's first real event, so there isn't a row count or growth rate
-- to size a retention window against yet. Recorded here rather than left
-- unspecified: no retention action now, revisit once a live event has run
-- and the actual row volume is known.
COMMENT ON TABLE bingo_player_hiscore_history IS
  'Append-only hiscore observation log (see 20260711000000_hiscore_conflict_history.sql). '
  'Retention policy: not yet set. Revisit after the next real bingo event, once real row '
  'volume and growth rate exist to size a window against. Do not guess a number before then. (#47)';
