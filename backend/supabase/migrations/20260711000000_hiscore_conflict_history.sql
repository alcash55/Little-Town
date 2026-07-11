-- Side-account conflict detection (Track B, Sprint 5) — supporting schema.
-- Replaces the removed `/bingo/conflicts` stub (todo.md: "now that
-- side-account snapshots are storable, design real conflict detection").
--
-- Problem: bingo_player_hiscores only ever holds TWO rows per account
-- (type='start', written once, and type='current', overwritten in place by
-- upsert_player_hiscore_current on every cron tick / manual refresh — see
-- 20260709000000_snapshot_upsert_rpc.sql). That means the table itself can
-- only ever describe ONE snapshot window per account
-- ([start.taken_at, current.taken_at]) — there is no way to see that an
-- account gained XP in more than one distinct time window, which the
-- frozen conflicts contract requires (`windows: [...]`, and "high" severity
-- specifically means "the same window more than once").
--
-- Fix: an append-only history log, populated by a trigger so every writer
-- of bingo_player_hiscores (today: savePlayerSnapshot's start/current
-- paths; any future writer) gets recorded automatically with zero
-- application-code changes. Each row is one observed (account, timestamp,
-- total XP) point; the conflicts query (src/db/conflicts.ts) turns
-- consecutive points per account into windows and looks for overlapping
-- main/side windows where both gained XP.
--
-- Non-destructive / reversible: only adds a new table, a new function, two
-- new triggers, and a one-time additive backfill INSERT from the existing
-- table (no existing rows are read destructively, updated, or deleted).
-- To reverse: DROP TRIGGER bingo_player_hiscores_log_insert ON
-- bingo_player_hiscores; DROP TRIGGER bingo_player_hiscores_log_update ON
-- bingo_player_hiscores; DROP FUNCTION log_hiscore_history();
-- DROP FUNCTION hiscore_total_xp(jsonb); DROP TABLE
-- bingo_player_hiscore_history; — no other table is touched.

-- ---------------------------------------------------------------------------
-- hiscore_total_xp: pulls the 'Overall' skill's xp out of a
-- bingo_player_hiscores.skills jsonb blob (the OSRS hiscores lite API
-- always includes an id=0/name="Overall" entry whose xp is the account's
-- total XP across all skills — see src/services/hiscores.ts and the
-- skillsPayload() fixture helper in tests/integration/players-snapshot-rpc
-- .test.ts). Matches by name rather than assuming array position 0, since
-- nothing in the schema enforces ordering. Returns 0 (not NULL) for an
-- empty/malformed blob so callers can sum/diff without null-checking.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hiscore_total_xp(p_skills jsonb)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (SELECT (elem->>'xp')::bigint
       FROM jsonb_array_elements(p_skills) AS elem
      WHERE elem->>'name' = 'Overall'
      LIMIT 1),
    0
  );
$$;

-- ---------------------------------------------------------------------------
-- bingo_player_hiscore_history: append-only log, one row per observed
-- snapshot write (start or current) for a primary or side account. Never
-- updated or deleted directly by application code — only ever grows via
-- the trigger below (plus the one-time backfill at the bottom of this
-- file). Denormalizes total_xp instead of storing skills/activities again
-- (the conflicts query only ever needs the XP delta between two points;
-- the full per-skill breakdown already lives in bingo_player_hiscores for
-- whichever snapshot is "current" right now).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bingo_player_hiscore_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES bingo_players(id) ON DELETE CASCADE,
  side_account_id UUID REFERENCES bingo_player_side_accounts(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('start', 'current')),
  total_xp        BIGINT NOT NULL,
  taken_at        TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query pattern: "all history points for this bingo's main accounts /
-- side accounts, oldest first" (src/db/conflicts.ts fetches both in one
-- bulk IN() query each, then walks them in memory). Partial indexes mirror
-- the uq_hiscores_primary / uq_hiscores_side convention from
-- 20260601000000_side_accounts.sql — a plain (player_id, taken_at) index
-- would otherwise also have to cover every side-account row under each
-- player_id, which no query here filters on directly.
CREATE INDEX IF NOT EXISTS bingo_hiscore_history_player_idx
  ON bingo_player_hiscore_history (player_id, taken_at)
  WHERE side_account_id IS NULL;

CREATE INDEX IF NOT EXISTS bingo_hiscore_history_side_idx
  ON bingo_player_hiscore_history (side_account_id, taken_at)
  WHERE side_account_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- log_hiscore_history: trigger function, fires once per row written to
-- bingo_player_hiscores. Kept a plain SECURITY INVOKER function (matches
-- every other function in this schema — see 20260706000000_audit_fixes.sql)
-- so it runs as whichever role performs the write (service_role today).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_hiscore_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO bingo_player_hiscore_history (player_id, side_account_id, type, total_xp, taken_at)
  VALUES (NEW.player_id, NEW.side_account_id, NEW.type, hiscore_total_xp(NEW.skills), NEW.taken_at);
  RETURN NEW;
END;
$$;

-- Every INSERT is a genuine new snapshot (either a first 'start'/'current'
-- row, or — pre-existing rows aside — impossible today since both RPCs
-- upsert onto a partial-unique-index arbiter). Always log.
DROP TRIGGER IF EXISTS bingo_player_hiscores_log_insert ON bingo_player_hiscores;
CREATE TRIGGER bingo_player_hiscores_log_insert
  AFTER INSERT ON bingo_player_hiscores
  FOR EACH ROW
  EXECUTE FUNCTION log_hiscore_history();

-- UPDATEs happen two ways:
--   1. upsert_player_hiscore_current's ON CONFLICT DO UPDATE — a real new
--      observation, skills/taken_at always change. Log it.
--   2. upsert_player_hiscore_start's ON CONFLICT DO UPDATE SET taken_at =
--      bingo_player_hiscores.taken_at — a deliberate no-op (see that RPC's
--      comment) so a second registration call can't overwrite the
--      original start snapshot. NEW.taken_at ends up IDENTICAL to
--      OLD.taken_at and skills is untouched, so the WHEN guard below skips
--      it — otherwise every redundant "is this player already registered"
--      call would spam a duplicate history point with a same-instant
--      zero-length window.
DROP TRIGGER IF EXISTS bingo_player_hiscores_log_update ON bingo_player_hiscores;
CREATE TRIGGER bingo_player_hiscores_log_update
  AFTER UPDATE ON bingo_player_hiscores
  FOR EACH ROW
  WHEN (OLD.taken_at IS DISTINCT FROM NEW.taken_at OR OLD.skills IS DISTINCT FROM NEW.skills)
  EXECUTE FUNCTION log_hiscore_history();

-- One-time backfill: give every snapshot row that already exists a history
-- point, so bingos already in progress get at least the one window their
-- start/current pair already implies instead of starting from zero history
-- until the next cron tick. Purely additive (INSERT ... SELECT from an
-- existing table into a brand-new one); nothing is deleted or modified.
INSERT INTO bingo_player_hiscore_history (player_id, side_account_id, type, total_xp, taken_at)
SELECT player_id, side_account_id, type, hiscore_total_xp(skills), taken_at
FROM bingo_player_hiscores;

-- ---------------------------------------------------------------------------
-- RLS: match the 20260709000002_deny_all_rls_policies.sql convention —
-- ENABLE ROW LEVEL SECURITY plus an explicit deny-all policy for
-- anon/authenticated. service_role has BYPASSRLS and already gets
-- SELECT/INSERT/UPDATE/DELETE via 20260707000000_service_role_grants.sql's
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres (this table is created by
-- `postgres`, same as everything else in this migration chain), so no
-- explicit GRANT is needed here.
-- ---------------------------------------------------------------------------
ALTER TABLE bingo_player_hiscore_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bingo_player_hiscore_history_deny_all ON public.bingo_player_hiscore_history;
CREATE POLICY bingo_player_hiscore_history_deny_all ON public.bingo_player_hiscore_history
  FOR ALL TO anon, authenticated USING (false);
