-- Quiet the Supabase advisor's "RLS enabled, no policies" warning across
-- every public table. All of them already have ROW LEVEL SECURITY ENABLED
-- (see 20260522000000_initial_schema.sql, 20260526000000_osrs_static_data.sql,
-- 20260526000001_bingo_players.sql, 20260601000000_side_accounts.sql), and
-- anon/authenticated already hold zero table grants (20260525000000_revoke
-- _public_access.sql, reasserted by 20260707000000_service_role_grants.sql)
-- -- so this is not closing an actual hole, PostgREST already returns
-- nothing for those roles. The advisor flags "RLS enabled with no policy"
-- specifically because Postgres's RLS default-deny-with-no-policy behavior
-- only protects roles that reach the table with *some* privilege in the
-- first place; a table with grants revoked and RLS enabled but zero
-- policies is not visibly different, from the advisor's static check, from
-- a misconfiguration where grants get restored later and RLS silently
-- fails open for lack of a policy. Explicit deny-all policies make the
-- "nobody but service_role touches this" intent durable and self-evident
-- even if a future migration re-grants table privileges by mistake.
--
-- service_role has BYPASSRLS (verified via `\du service_role`), so it is
-- unaffected by any policy here and needs none -- these policies exist
-- purely for anon/authenticated.
--
-- DROP POLICY IF EXISTS + CREATE POLICY (rather than a bare CREATE, which
-- has no IF NOT EXISTS form) keeps this file safe to re-run.

DROP POLICY IF EXISTS users_deny_all ON public.users;
CREATE POLICY users_deny_all ON public.users FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS bingos_deny_all ON public.bingos;
CREATE POLICY bingos_deny_all ON public.bingos FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS bingo_teams_deny_all ON public.bingo_teams;
CREATE POLICY bingo_teams_deny_all ON public.bingo_teams FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS bingo_board_tiles_deny_all ON public.bingo_board_tiles;
CREATE POLICY bingo_board_tiles_deny_all ON public.bingo_board_tiles FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS bingo_submissions_deny_all ON public.bingo_submissions;
CREATE POLICY bingo_submissions_deny_all ON public.bingo_submissions FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS hiscore_cache_deny_all ON public.hiscore_cache;
CREATE POLICY hiscore_cache_deny_all ON public.hiscore_cache FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS osrs_static_data_deny_all ON public.osrs_static_data;
CREATE POLICY osrs_static_data_deny_all ON public.osrs_static_data FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS bingo_players_deny_all ON public.bingo_players;
CREATE POLICY bingo_players_deny_all ON public.bingo_players FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS bingo_player_hiscores_deny_all ON public.bingo_player_hiscores;
CREATE POLICY bingo_player_hiscores_deny_all ON public.bingo_player_hiscores FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS bingo_player_side_accounts_deny_all ON public.bingo_player_side_accounts;
CREATE POLICY bingo_player_side_accounts_deny_all ON public.bingo_player_side_accounts FOR ALL TO anon, authenticated USING (false);
