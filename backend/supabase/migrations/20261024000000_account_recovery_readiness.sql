-- Read-only boot gate. Use the caller's privileges, matching backend queries.
CREATE FUNCTION public.account_recovery_schema_ready() RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM session_version FROM public.users LIMIT 0;
  PERFORM token_hash, user_id, expires_at, used_at, revoked_at
    FROM public.password_resets LIMIT 0;
  PERFORM key_hash, started_at, attempts FROM public.recovery_limits LIMIT 0;
  RETURN COALESCE(
    has_function_privilege(current_user, to_regprocedure('public.take_recovery_limit(text)'), 'EXECUTE')
    AND has_function_privilege(current_user, to_regprocedure('public.issue_password_reset(uuid,text)'), 'EXECUTE')
    AND has_function_privilege(current_user, to_regprocedure('public.consume_password_reset(text,text)'), 'EXECUTE')
    AND EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.users'::regclass
        AND tgname = 'password_sessions' AND tgenabled IN ('O', 'A')
        AND tgfoid = to_regprocedure('public.invalidate_password_sessions()')
    ), false);
END;
$$;
REVOKE ALL ON FUNCTION public.account_recovery_schema_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_recovery_schema_ready() TO service_role;
NOTIFY pgrst, 'reload schema';
