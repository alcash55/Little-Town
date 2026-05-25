-- Revoke public and authenticated role access from all tables.
-- The backend exclusively uses the service_role key, so no table needs
-- to be directly accessible to anon or authenticated Supabase roles.

-- Revoke from public schema default privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Explicitly revoke SELECT on users to fix the GraphQL exposure warning
REVOKE SELECT ON public.users FROM authenticated;
REVOKE SELECT ON public.users FROM anon;

-- Lock down all other tables too
REVOKE SELECT ON public.bingos FROM authenticated, anon;
REVOKE SELECT ON public.bingo_teams FROM authenticated, anon;
REVOKE SELECT ON public.bingo_board_tiles FROM authenticated, anon;
REVOKE SELECT ON public.bingo_submissions FROM authenticated, anon;
REVOKE SELECT ON public.hiscore_cache FROM authenticated, anon;

-- Ensure future tables don't inherit public access
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
