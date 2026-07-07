-- Fix repo-wide missing service_role privileges.
--
-- Root cause (confirmed via pg_default_acl on a fresh `supabase db reset`):
-- every table/function in this schema is created by migrations running as
-- the `postgres` role, and the *default privileges owned by `postgres`* on
-- schema public only include:
--   tables:    service_role => Dxtm   (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN)
--   sequences: service_role => w      (UPDATE only)
--   functions: service_role => (none) (only the owner `postgres` gets EXECUTE)
-- i.e. no SELECT/INSERT/UPDATE/DELETE on tables, no USAGE/SELECT on
-- sequences, no EXECUTE on functions for service_role. Compare with the
-- default privileges owned by `supabase_admin` on the same schema, which
-- *do* grant service_role (and anon/authenticated) full rwarwdDxtm/X access
-- -- that's the role Supabase's platform bootstrap uses to provision a
-- fresh hosted project, so hosted/production databases have historically
-- gotten working service_role grants "for free" pre-dating this migration
-- chain. No migration in this repo ever GRANTed anything to service_role
-- directly, so a database built purely from this migration chain (a local
-- `db reset`, or a future restore) ends up with a service_role that gets
-- 42501 "permission denied" from PostgREST on every table and RPC call.
--
-- Fix: grant service_role explicit DML/EXECUTE access on everything that
-- exists today, and set default privileges FOR ROLE postgres (the role
-- that owns every object created by this migration chain) so future
-- tables/sequences/functions pick up the same grants automatically.
-- anon/authenticated remain locked out, per the
-- 20260525000000_revoke_public_access.sql convention.
--
-- All statements are additive grants (or ALTER DEFAULT PRIVILEGES, which
-- only affects objects created after this runs) -- safe to run against
-- production without any data risk, and safe to re-run.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION replace_bingo_board(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION replace_bingo_teams(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION set_team_captain(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION activate_bingo(uuid) TO service_role;

-- Keep anon/authenticated exactly as locked out as 20260525000000 left
-- them; re-asserting here is a harmless no-op if already revoked, and
-- guards against a future table/function that skips that convention.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Ensure every future table/sequence/function created by migrations
-- (which run as `postgres`) grants service_role the access it needs, and
-- nothing to anon/authenticated -- mirrors the ALTER DEFAULT PRIVILEGES
-- statements in 20260525000000_revoke_public_access.sql but scoped
-- FOR ROLE postgres explicitly (the actual owning role, verified above)
-- rather than relying on whichever role happens to run this statement.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
