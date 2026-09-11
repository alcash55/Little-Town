-- Local-dev-only fixture data, applied automatically by `bun run db:reset`
-- (see supabase/config.toml's [db.seed] block) and never by `db:push` — so
-- these rows can never reach hosted Supabase the way the old migration-based
-- insert did (issue #51).
--
-- password_hash's `dev:` prefix is a plaintext-comparison sentinel read by
-- verifyPassword() (src/db/users.ts), gated on ALLOW_DEV_AUTH=true and
-- NODE_ENV=development — both true by default in dev-local.sh, false in
-- every deployed environment. Login locally with admin/password or
-- user/password.
INSERT INTO users (username, email, password_hash, role)
VALUES
  ('admin', 'admin@littletown.local', 'dev:password', 'admin'),
  ('user', 'user@littletown.local', 'dev:password', 'user')
ON CONFLICT (username) DO NOTHING;
