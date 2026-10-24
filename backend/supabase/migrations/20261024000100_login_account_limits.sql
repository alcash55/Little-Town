-- Apply before backend rollout. No unknown-identifier rows or password data.
CREATE TABLE public.login_account_limits (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 300)
);
ALTER TABLE public.login_account_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_account_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.login_account_limits TO service_role;

-- INSERT ... ON CONFLICT locks the account's counter across backend instances.
-- Saturate the counter and leave the original window unchanged when blocked.
-- Unknown UUIDs cannot allocate rows. Account deletion cascades the only key.
CREATE FUNCTION public.take_login_account_limit(p_user_id uuid, p_max integer)
RETURNS boolean
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE n integer; attempted_at timestamptz := statement_timestamp();
BEGIN
  IF p_max IS NULL OR p_max < 1 OR p_max > 300 THEN
    RAISE EXCEPTION 'Invalid login limit';
  END IF;
  INSERT INTO public.login_account_limits AS limits (user_id, started_at, attempts)
    SELECT id, attempted_at, 1 FROM public.users WHERE id = p_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    attempts = CASE WHEN limits.started_at <= attempted_at - interval '15 minutes'
      THEN 1 ELSE limits.attempts + 1 END,
    started_at = CASE WHEN limits.started_at <= attempted_at - interval '15 minutes'
      THEN attempted_at ELSE limits.started_at END
  WHERE limits.started_at <= attempted_at - interval '15 minutes'
    OR limits.attempts < p_max
  RETURNING attempts INTO n;
  RETURN COALESCE(n <= p_max, false);
END;
$$;
REVOKE ALL ON FUNCTION public.take_login_account_limit(uuid,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_login_account_limit(uuid,integer) TO service_role;
NOTIFY pgrst, 'reload schema';
