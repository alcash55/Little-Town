-- User <-> RSN identity claims (TEAM-BRIEF.md Sprint 11, Track A).
--
-- This is the "persist the claimed RSN" follow-up flagged in Sprint 10:
-- until now, nothing recorded which `users` row a given OSRS account
-- (`bingo_players.rsn`) belongs to -- `registered_by` on bingo_players is
-- whoever RAN the registration call (usually an admin registering someone
-- else via Team Drafter), not a self-service ownership link (see the
-- comment on db/users.ts's listUsers). POST /api/onboarding/rsn is the
-- first self-service path that needs a real one.
--
-- Design (documented in full in the Track A sprint report):
--   - Deliberately NOT a FK to a specific bingo_players row. The Team
--     Drafter's "player pool" is bingo-scoped (bingo_players.bingo_id, see
--     getActiveBingo()) -- a fresh set of bingo_players rows gets created
--     for every new bingo cycle, so a claim tied to one specific row would
--     silently stop meaning anything the moment that bingo is archived and
--     a new one starts. RSN ownership is a real-world identity fact ("this
--     Little Town account IS this OSRS account") that should outlive any
--     single bingo cycle, so it's keyed on the RSN string itself.
--     POST /api/onboarding/rsn re-resolves the current active/draft
--     bingo_players pool row (create-or-find) on every call using this
--     table only to decide who's allowed to hold the RSN.
--   - `rsn_normalized` (lowercased) is the actual uniqueness/lookup key,
--     not `rsn` -- OSRS names are case-insensitive (matches the existing
--     .toLowerCase() comparison convention in
--     services/rsnChangeDetection.ts) so "Zezima" and "zezima" must be
--     treated as the same claim, even though the RSN's on-file
--     capitalization can vary depending on how a given caller typed it (the
--     OSRS hiscore lite endpoint echoes back whatever capitalization was
--     queried with, rather than returning the true canonical form, so there
--     is no authoritative capitalization to normalize to here).
--   - UNIQUE(user_id): the abuse-guard half of this table (TEAM-BRIEF.md
--     Track A item 4) -- "any authed user can now add players to the pool"
--     is capped at one claimed identity per user, changeable (re-claiming
--     under a different RSN updates the existing row rather than piling up
--     a second one). This is the cheap, obvious guard; the fuller
--     abuse-surface discussion (no verification tying a claim to real
--     account ownership beyond "you typed a working RSN first") is in the
--     sprint report's "For next sprint" list.
--   - UNIQUE(rsn_normalized): the ownership-conflict half -- an RSN can be
--     claimed by at most one user account at a time. This is what
--     POST /api/onboarding/rsn's 409 RSN_TAKEN checks against.
--
-- Alex applies prod migrations by hand -- this one is NOT auto-applied.

CREATE TABLE IF NOT EXISTS rsn_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rsn            TEXT NOT NULL,
  rsn_normalized TEXT NOT NULL,
  claimed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (rsn_normalized)
);

-- No explicit GRANT needed -- default privileges FOR ROLE postgres
-- (20260707000000_service_role_grants.sql) already cover every future
-- table with SELECT/INSERT/UPDATE/DELETE for service_role, and REVOKE ALL
-- for anon/authenticated.

-- RLS: same deny-all convention as every other table
-- (20260709000002_deny_all_rls_policies.sql / 20260713000000_invites.sql).
-- service_role has BYPASSRLS so is unaffected; this is for anon/authenticated.
ALTER TABLE rsn_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rsn_claims_deny_all ON public.rsn_claims;
CREATE POLICY rsn_claims_deny_all ON public.rsn_claims
  FOR ALL TO anon, authenticated USING (false);
