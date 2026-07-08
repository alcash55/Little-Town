
# Epics (Alex)

- Create Admin page for sending or generating links to onboard new users
-   Create onboarding wizard for first time users
- Start the bingo submission page, have it pull images from the bucket that is in supabase or cloudflare
  - Create an API that uses the discord api that pulls messages from a text channel in the littletown discord and POSTs them to the storage bucket
  - If an admin approves the screenshot is will react to the image with a thumbs up and then add the points to that teams board and related stats
  - If an admin denies the screenshot it will react to the image with as thumbs down
- Finish the resource page that includes many tips, strats, screenshots, tiles, and how tos for different oses content with info from the Little Town discord text channel #resources
- Create an admin page that can manually trigger the re-running of cron jobs etc.
  curl -X POST http://localhost:8081/api/admin/static-data/refresh \
   -H "Authorization: Bearer <your_token>"
- Upgrade the frontend styled component library to the latest version of MUI, then audit each page to ensure no bugs/issues
  - Migrate away from victory charts and use the MUI charts instead
- Bingo overview:
  - The number of players seems to not be working
  - There should be a section for seeing the health of any APIs/DBs/Renderer/cloudflare we use to make sure there isn't any downtime/outages
  - The overall dashboard does not look very good and should be updated in the design and overall layout, this should look like it was designed by an extemely high up senior designer that includes many beautiful and easy to read data visalizations
- Select/Autocopmlete bug where the options and the background are all white ot light gray and you cannot see what the options are because the contrast is bad

# Next sprint — carried over from the July 2026 audit sprint

- **Stale unique constraint is load-bearing (found 2026-07-07):** `bingo_player_snapshots_player_id_type_key` (full UNIQUE on player_id,type) survived the table rename — migration 20260601000000 tried to drop it under the wrong name. It is currently what makes all snapshot upserts work (the partial indexes uq_hiscores_primary/side cannot be PostgREST upsert arbiters). Consequence: side-account snapshots (same player_id + type as a primary row) CANNOT be stored until this is redesigned. When implementing side-account snapshot storage: drop the stale constraint AND move snapshot writes into an RPC that specifies the partial-index predicate in ON CONFLICT. Do not drop the constraint before that RPC exists.

- Promote the local `appColors` palette in `TeamData.tsx` into `layout/Theme` once the pending theme rework lands (TODO comment marks the spot).
- Implement or remove the three admin endpoints BingoOverview expects but that don't exist: `GET /api/admin/bingo/player-stats`, `/bingo/conflicts`, `/bingo/screenshots/pending` (frontend polling is disabled with a TODO; the UI sections render empty). Conflicts detection pairs naturally with the screenshot-submission epic.
- Decide activation semantics when snapshots fail: today a bingo activates even if every OSRS hiscore lookup failed, leaving players without start snapshots (their deltas read zero until re-registered). Consider blocking activation below a snapshot success threshold, or a "retake missing start snapshots" admin action.
- `/api/hiscores/:player` is an unauthenticated OSRS proxy — decide whether it should require auth or stay public with its own rate limit.
- Tests: the repo has zero automated tests. Seed a minimal suite around the drift-prone spots this sprint exposed (status transitions, snapshot idempotency, team replacement).
