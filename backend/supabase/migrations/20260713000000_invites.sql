-- Admin invite links (TEAM-BRIEF.md Sprint 6, Track A item 1).
--
-- Auth-stack context (see the Track A report for the full writeup): this app
-- does NOT use Supabase Auth — `users` is a plain table with bcrypt
-- `password_hash`, JWTs are signed/verified by this backend (src/lib/jwt.ts,
-- src/middleware/auth.ts), and there is no self-registration endpoint today.
-- An invite's "accept" flow therefore has to create a `users` row itself.
--
-- Design:
--   - Tokens are single-use, opaque, 256-bit random values. Only a SHA-256
--     hash of the token is ever stored (token_hash) -- mirrors the existing
--     password_hash convention of never storing secrets recoverably. This is
--     why GET /api/admin/invites can only return `url` at creation time (the
--     one moment the raw token exists in memory) and `null` afterward -- see
--     src/db/invites.ts.
--   - `accept_invite(...)` is a single Postgres function so "check the
--     invite is still valid, create the user, and mark the invite used" is
--     one atomic transaction (a `SELECT ... FOR UPDATE` on the invite row
--     serializes concurrent accepts of the same token, closing the
--     check-then-act race a multi-request flow would have). Matches the
--     existing convention of pushing multi-step invariants into an RPC (see
--     set_team_captain, activate_bingo, replace_bingo_board).
--   - Password hashing still happens in application code (bcrypt, via
--     db/users.ts's existing hashPassword) -- the RPC only ever receives an
--     already-hashed password, never a plaintext one.

CREATE TABLE IF NOT EXISTS invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup pattern: "does this raw token (hashed) resolve to a live invite" on
-- every GET /api/invites/:token and accept call.
CREATE INDEX IF NOT EXISTS invites_token_hash_idx ON invites (token_hash);
-- Listing pattern: GET /api/admin/invites, newest first.
CREATE INDEX IF NOT EXISTS invites_created_at_idx ON invites (created_at DESC);

-- ---------------------------------------------------------------------------
-- accept_invite: validates the invite (unknown/revoked/used/expired -> a
-- distinct RAISE EXCEPTION message each, matched by message text in
-- src/db/invites.ts -- mirrors the existing set_team_captain /not found/i
-- convention rather than custom SQLSTATEs), creates the user under the
-- invite's role, and marks the invite used, all inside one transaction.
-- `FOR UPDATE` on the invite row means a second concurrent call for the same
-- token blocks until the first commits, then correctly sees used_at IS NOT
-- NULL -- single-use is enforced here, not just at the application layer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_invite(
  p_token_hash TEXT,
  p_username TEXT,
  p_password_hash TEXT,
  p_nickname TEXT DEFAULT NULL
) RETURNS users
LANGUAGE plpgsql
AS $$
DECLARE
  v_invite invites%ROWTYPE;
  v_user users%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM invites WHERE token_hash = p_token_hash FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has been revoked';
  END IF;

  IF v_invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been used';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  INSERT INTO users (username, password_hash, nickname, role)
  VALUES (p_username, p_password_hash, p_nickname, v_invite.role)
  RETURNING * INTO v_user;

  UPDATE invites SET used_at = now(), used_by = v_user.id WHERE id = v_invite.id;

  RETURN v_user;
END;
$$;

-- No explicit GRANT needed for the table, index, or function -- default
-- privileges FOR ROLE postgres (20260707000000_service_role_grants.sql)
-- already cover every future table/function with SELECT/INSERT/UPDATE/DELETE
-- and EXECUTE for service_role, and REVOKE ALL for anon/authenticated.

-- ---------------------------------------------------------------------------
-- RLS: same deny-all convention as every other table
-- (20260709000002_deny_all_rls_policies.sql / 20260711000000_hiscore_
-- conflict_history.sql). service_role has BYPASSRLS so is unaffected.
-- ---------------------------------------------------------------------------
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invites_deny_all ON public.invites;
CREATE POLICY invites_deny_all ON public.invites
  FOR ALL TO anon, authenticated USING (false);
