-- Fix Supabase advisor warning "function_search_path_mutable" on 8
-- functions, found by re-running the advisor after applying
-- 20260715000000_rsn_claims.sql to prod (TEAM-BRIEF.md Sprint 17, Track A2
-- follow-up). Same fix, same rationale, as the one function this had
-- already been done for: 20260714000000_fix_log_hiscore_history_search_path.sql.
--
-- Every one of these is plpgsql or sql, SECURITY INVOKER (the default,
-- unchanged -- matches the explicit "no SECURITY DEFINER in this schema"
-- convention from 20260706000000_audit_fixes.sql's header), with EXECUTE
-- already revoked from anon/authenticated (each function's own migration
-- REVOKEs PUBLIC/anon/authenticated and, where present, GRANTs only to
-- service_role) -- so exploiting a mutable search_path here would require
-- already holding the service_role key. Hygiene, not an emergency; fixed
-- anyway because the advisor flags it and the precedent for pinning it is
-- already established.
--
-- All 8 reference unqualified table/function names (bingos,
-- bingo_board_tiles, bingo_teams, bingo_players, bingo_player_hiscores,
-- users, invites, hiscore_total_xp) that need to resolve against `public`,
-- so -- matching 20260714000000's reasoning -- this pins search_path to
-- `public, pg_temp` (Supabase's own remediation guidance: keep pg_temp so
-- legitimate temp-table use elsewhere in the session is unaffected) rather
-- than an empty search_path, which would require qualifying every
-- reference instead.
--
-- No behavior change, no application code changes -- only search_path
-- resolution is pinned on each function declaration. Reversible per
-- function: ALTER FUNCTION <name>(<args>) RESET search_path; (all 8 listed
-- below, mirroring 20260714000000's own reversal note).

ALTER FUNCTION public.replace_bingo_board(uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.replace_bingo_teams(uuid, text[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_team_captain(uuid, text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.activate_bingo(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_player_hiscore_start(uuid, uuid, jsonb, jsonb, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_player_hiscore_current(uuid, uuid, jsonb, jsonb, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.hiscore_total_xp(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.accept_invite(text, text, text, text) SET search_path = public, pg_temp;
