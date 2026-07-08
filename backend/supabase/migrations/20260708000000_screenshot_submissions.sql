-- Discord screenshot submission pipeline: extend bingo_submissions with the
-- columns the ingest bot / review endpoints need, and add a private storage
-- bucket to hold the uploaded images.
--
-- bingo_submissions already has, from 20260522000000_initial_schema.sql:
--   tile_id  UUID REFERENCES bingo_board_tiles(id) ON DELETE SET NULL, nullable
--   team_id  UUID REFERENCES bingo_teams(id) ON DELETE SET NULL, nullable
--   reviewed_by UUID REFERENCES users(id)
--   reviewed_at TIMESTAMPTZ
--   status TEXT ... CHECK (status IN ('pending', 'approved', 'rejected'))
-- i.e. exactly the "admin assigns tile/team at review" shape the contract
-- asks for -- no changes needed to those columns or the status check.
-- This migration only adds the two columns the Discord ingest path needs.

ALTER TABLE bingo_submissions
  ADD COLUMN IF NOT EXISTS discord_message_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS image_path TEXT;

COMMENT ON COLUMN bingo_submissions.discord_message_id IS
  'Discord message id the screenshot was attached to. UNIQUE so the bot''s '
  'startup backfill / re-scan can INSERT ... ON CONFLICT (discord_message_id) '
  'DO NOTHING and safely no-op on already-ingested messages. Postgres UNIQUE '
  'allows multiple NULLs, so non-Discord submissions are unaffected.';
COMMENT ON COLUMN bingo_submissions.image_path IS
  'Object path (not URL) of the screenshot inside the private storage.screenshots bucket.';

-- Hot path: GET /api/admin/bingo/screenshots/pending is polled by the admin
-- UI (see useBingoOverview.ts) and filters on status = 'pending'. Partial
-- index keeps that lookup cheap regardless of how many approved/rejected
-- submissions accumulate over time (pending rows are always a small,
-- fast-turnover subset of the table).
CREATE INDEX IF NOT EXISTS bingo_submissions_pending_idx
  ON bingo_submissions (bingo_id, created_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Private storage bucket for Discord-sourced screenshots.
--
-- public = false, and no storage.objects/storage.buckets RLS policies are
-- created here: Supabase's service_role has BYPASSRLS, so the backend
-- (service_role key only, per 20260525000000_revoke_public_access.sql) has
-- full read/write access already, while anon/authenticated get nothing
-- because no policy grants them anything -- the same
-- "service_role-only, deny by default" convention as
-- 20260707000000_service_role_grants.sql, just enforced by the absence of
-- policies rather than an explicit REVOKE (storage.objects/buckets are
-- owned by the supabase_storage_admin role, not this migration chain, so
-- REVOKE ALL ... FROM anon, authenticated here would fail with
-- "must be owner of relation objects").
-- ON CONFLICT DO NOTHING makes this safe to re-run and safe against a
-- hosted project where the bucket may already exist.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screenshots',
  'screenshots',
  false,
  52428800, -- 50 MiB, matches [storage].file_size_limit in supabase/config.toml
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;
