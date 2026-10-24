-- Additive account recovery. Apply before deploying the backend.
ALTER TABLE public.users ADD COLUMN session_version integer NOT NULL DEFAULT 0;
CREATE TABLE public.password_resets (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX password_resets_user ON public.password_resets(user_id);
CREATE TABLE public.recovery_limits (
  key_hash text PRIMARY KEY,
  started_at timestamptz NOT NULL,
  attempts integer NOT NULL
);
CREATE INDEX recovery_limits_started ON public.recovery_limits(started_at);
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_resets, public.recovery_limits FROM anon, authenticated;
GRANT ALL ON public.password_resets, public.recovery_limits TO service_role;

-- The trigger also covers direct admin/database password changes.
CREATE FUNCTION public.invalidate_password_sessions() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.session_version := OLD.session_version + 1;
    UPDATE public.password_resets SET revoked_at = now()
      WHERE user_id = OLD.id AND used_at IS NULL AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER password_sessions BEFORE UPDATE OF password_hash ON public.users
FOR EACH ROW EXECUTE FUNCTION public.invalidate_password_sessions();

-- Cross-process account limits include unknown identifiers. No account lookup here.
CREATE FUNCTION public.take_recovery_limit(p_key_hash text) RETURNS boolean
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.recovery_limits WHERE started_at < now() - interval '1 day';
  INSERT INTO public.recovery_limits VALUES (p_key_hash, now(), 1)
  ON CONFLICT (key_hash) DO UPDATE SET
    attempts = CASE WHEN recovery_limits.started_at <= now() - interval '15 minutes'
      THEN 1 ELSE recovery_limits.attempts + 1 END,
    started_at = CASE WHEN recovery_limits.started_at <= now() - interval '15 minutes'
      THEN now() ELSE recovery_limits.started_at END
  RETURNING attempts INTO n;
  RETURN n <= 3;
END;
$$;

CREATE FUNCTION public.issue_password_reset(p_user_id uuid, p_token_hash text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recovery account unavailable'; END IF;
  UPDATE public.password_resets SET revoked_at = now()
    WHERE user_id = p_user_id AND used_at IS NULL AND revoked_at IS NULL;
  DELETE FROM public.password_resets WHERE user_id = p_user_id
    AND expires_at < now() - interval '7 days';
  INSERT INTO public.password_resets(token_hash, user_id) VALUES(p_token_hash, p_user_id);
END;
$$;

CREATE FUNCTION public.consume_password_reset(p_token_hash text, p_password_hash text) RETURNS text
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE r public.password_resets; uid uuid;
BEGIN
  -- Always lock the user before the reset row, matching issuance and the trigger.
  SELECT user_id INTO uid FROM public.password_resets WHERE token_hash = p_token_hash;
  IF uid IS NULL THEN RETURN 'invalid'; END IF;
  PERFORM 1 FROM public.users WHERE id = uid FOR UPDATE;
  SELECT * INTO r FROM public.password_resets WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  IF r.used_at IS NOT NULL THEN RETURN 'used'; END IF;
  IF r.revoked_at IS NOT NULL THEN RETURN 'invalid'; END IF;
  IF r.expires_at <= clock_timestamp() THEN RETURN 'expired'; END IF;
  IF p_password_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' THEN
    RAISE EXCEPTION 'Expected bcrypt password hash';
  END IF;
  UPDATE public.users SET password_hash = p_password_hash, updated_at = now() WHERE id = uid;
  UPDATE public.password_resets SET used_at = now() WHERE token_hash = p_token_hash;
  RETURN 'complete';
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_password_sessions(), public.take_recovery_limit(text),
  public.issue_password_reset(uuid,text), public.consume_password_reset(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_recovery_limit(text), public.issue_password_reset(uuid,text),
  public.consume_password_reset(text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
