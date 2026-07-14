# db

Data access layer. Files in this directory are responsible for reading and writing to the Supabase database. Each file maps to a domain entity and exports async functions that the route handlers call. No business logic or HTTP concerns belong here — only queries.

## Files

### `client.ts`
Creates and caches a single Supabase client instance (singleton). Every other file in this directory calls `getDb()` to get the shared connection. Validates that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set before allowing any queries.

### `bingos.ts`
All database operations for bingo data. Exports:
- `listBingos` — fetch all bingos with their teams and tiles
- `getActiveBingo` — fetch the most recent active or draft bingo
- `saveBingoDetails` — insert a new bingo and its teams
- `updateBingo` — update bingo fields and optionally replace its teams
- `saveActiveBingoBoard` — replace all tiles on the active bingo
- `getActiveBingoBoard` — fetch all tiles for the active bingo ordered by position

### `users.ts`
All database operations for user data. Exports:
- `findUserByUsername` — look up a user by username, used during login
- `loginUser` — verify credentials and return a safe user object (no password hash)
- `findUserById` — look up a user by UUID, used by the auth middleware on every protected request
  (and by impersonation to resolve `X-Impersonate-User-Id`)
- `hashPassword` — hash a plain text password with bcrypt before storing
- `listUsers` — every user as `{ id, label, role }` for the impersonation picker (`GET
  /api/admin/users`); `label` is nickname-or-username, the same display-name fallback the app bar
  uses

### `invites.ts`
Admin invite links (Sprint 6, Track A item 1). Only a SHA-256 hash of each token is stored — see
the header comment for why `GET /api/admin/invites` can never return a usable `url` after creation.
Exports `createInvite`, `listInvites`, `revokeInvite`, `validateInviteToken` (public lookup), and
`acceptInvite` (creates the `users` row under the invite's role and burns the invite, atomically,
via the `accept_invite` Postgres function).

### `teamXpHistory.ts`
`getTeamXpHistory(bingoId, teams)` — per-team daily XP-gained series for the BingoScores chart
(`GET /api/bingo/team-xp-history`, Sprint 6, Track A item 3), sourced from
`bingo_player_hiscore_history`. Bucketing/carry-forward rules are documented in the file's header
comment.

### `bingoSubmissions.ts`
All database operations for `bingo_submissions` (screenshot review queue), plus signed-URL
access to the private `screenshots` storage bucket. Exports:
- `submissionExistsByDiscordMessageId` / `insertPendingSubmission` — used by the Discord ingest
  service for dedupe-safe inserts (`discord_message_id` UNIQUE)
- `getPendingSubmissions`, `getSubmissionById` — used by the admin review routes
- `approveSubmission`, `denySubmission` — admin review actions. `approveSubmission` accepts an
  optional `playerId`, persisted to `bingo_submissions.player_id` (validated by the route handler)
- `getSignedScreenshotUrl` — short-lived signed URL for a stored screenshot object path

(Note: this file predates `players.ts` and `staticData.ts`, which also aren't listed above.)

### `playerStats.ts`
`getPlayerStats(bingoId)` — per-player stats (tiles completed, points, last seen, side accounts) for
the admin overview page, attributed via `bingo_submissions.player_id`. Aggregates over a fixed set of
bulk queries (players/teams/tiles/approved submissions/snapshots/side accounts) rather than querying
per player.

### `rsnClaims.ts`
`rsn_claims` (Sprint 11, Track A) — which `users` row owns which OSRS account, independent of any
single bingo cycle's player pool. Exports `findRsnClaim` (lookup by normalized/lowercased RSN, used
for the 409 `RSN_TAKEN` conflict check), `findRsnClaimByUser`, and `upsertRsnClaim` (one claim per
user — re-claiming under a different RSN moves the existing row). See the migration header
(`supabase/migrations/20260715000000_rsn_claims.sql`) for the full design rationale.

(`players.ts`'s `findBingoPlayerCaseInsensitive`, added the same sprint, also feeds
`POST /api/onboarding/rsn` — see `routes/onboarding.ts`.)