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

### `hiscores.ts`
OSRS hiscores routes at `/api/hiscores`:
- `GET /:player` — fetch live hiscore data for a player from the OSRS API
- `GET /skills/list` — scrape the RuneScape wiki for the current list of skills
- `GET /activities/list` — scrape the RuneScape wiki for the current list of activities
- `PUT /:player` — refresh hiscore data for a player (requires `protect`)