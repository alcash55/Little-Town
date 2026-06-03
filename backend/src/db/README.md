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