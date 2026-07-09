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
- `hashPassword` — hash a plain text password with bcrypt before storing

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