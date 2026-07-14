# routes

Express route handlers. Each file maps to a top-level API path and is responsible for parsing the request, calling into `db/` or `services/`, and returning an HTTP response. Route files should not contain database queries or business logic directly — delegate to the appropriate layer.

## Files

### `auth.ts`
Handles user authentication at `/api/auth`:
- `POST /login` — validates credentials via `loginUser`, signs a 24h JWT, returns the token and user object
- `GET /me` — returns the currently authenticated user (requires `protect`)
- `POST /logout` — client-side logout acknowledgement (token removal is handled by the frontend)

### `admin.ts`
Admin-only routes at `/api/admin`. All routes require `protect` + `authorize("admin", "moderator")`. Handles the full bingo lifecycle:
- `POST /bingo` — create a bingo via the full `BingoConfig` shape
- `GET /bingo` — list all bingos
- `PUT /bingo/:id` — update a bingo by ID
- `POST /bingo/details` — create a bingo from the frontend BingoDetails form
- `GET /bingo/details` — get the current active or draft bingo
- `POST /bingo/board` — save the tile board for the active bingo
- `PUT /bingo/board` — replace the tile board for the active bingo
- `GET /bingo/board` — get the current tile board
- `GET /bingo/screenshots/pending` — pending Discord screenshot submissions with signed image URLs
- `POST /bingo/screenshots/:id/approve` — approve a submission; body `{ tileId, teamId, playerId? }`.
  `playerId`, if present, must be a `bingo_players.id` on `teamId` within the submission's bingo (400
  otherwise) and is persisted to `bingo_submissions.player_id`.
- `POST /bingo/screenshots/:id/deny` — deny a submission
- `GET /bingo/player-stats` — per-player stats (tiles completed, points, last seen, side accounts) for
  the active bingo, aggregated via `db/playerStats.ts`

(Note: this file predates several other admin.ts routes — e.g. players, team draft, side
accounts, snapshot refresh — that aren't listed above either.)

### `hiscores.ts`
OSRS hiscores routes at `/api/hiscores`:
- `GET /:player` — fetch live hiscore data for a player from the OSRS API
- `GET /skills/list` — scrape the RuneScape wiki for the current list of skills
- `GET /activities/list` — scrape the RuneScape wiki for the current list of activities
- `PUT /:player` — refresh hiscore data for a player (requires `protect`)

### `invites.ts`
Admin invite links (Sprint 6, Track A item 1). Exports two routers, both mounted in `index.ts`
**before** `adminRoutes` — see the mount-order comment there:
- `adminInviteRoutes` at `/api/admin/invites` (`protect` + `authorize("admin")`): `POST /`, `GET /`,
  `DELETE /:id`
- `publicInviteRoutes` at `/api/invites` (no auth — this IS the pre-auth flow, rate-limited in
  `index.ts` like login): `GET /:token` (validate), `POST /:token/accept` (create the account and
  log the new user in)

### `adminUsers.ts`
`GET /api/admin/users` — the impersonation-target picker (Sprint 6, Track A item 2). A separate
router (not folded into `admin.ts`) so it can use `authorizeReal("admin")` instead of `authorize`,
staying reachable by an admin who is currently impersonating someone else. Mounted before
`adminRoutes` for the same reason as `invites.ts`.

### `onboarding.ts`
`POST /api/onboarding/rsn` — the onboarding wizard's RSN claim (Sprint 11, Track A frozen
contract). `protect`-gated (effective-user aware — impersonation applies) plus a per-IP rate
limit (same posture as `hiscores.ts`'s public proxy limiter, since this route also drives a
server-side hiscores lookup). Validates the RSN against the OSRS hiscores server-side, records
the caller's ownership in `db/rsnClaims.ts`, and create-or-finds the corresponding
`bingo_players` row in the current active/draft bingo's pool (case-insensitively, via
`db/players.ts`'s `findBingoPlayerCaseInsensitive`, so an admin-pre-registered RSN gets linked
rather than duplicated). See the route file's header comment and
`supabase/migrations/20260715000000_rsn_claims.sql` for the full design writeup.