# Little Town Backend

A Bun.js/Express backend API for the Little Town application with JWT authentication, role-based access control, OSRS hiscore integration, and a [Supabase/Postgres database](https://supabase.com/dashboard/org/epmondjdvtqxugkfrhgc).

## Features

- JWT-based authentication with role-based access control (`user`, `moderator`, `admin`)
- Security middleware: Helmet, CORS, rate limiting
- OSRS hiscore data fetching and processing via the official OSRS API
- RuneScape Wiki scraping for skills and activities lists (Puppeteer)
- Bingo game management through protected admin routes
- Supabase/Postgres database for both local development and hosted deployment
- Google Cloud Functions compatible entry point
- TypeScript with strict type checking

## Prerequisites

- Node.js 20+
- Bun.js
- Docker Desktop for local database development, set up once as described in
  [Docker Desktop and WSL](#docker-desktop-and-wsl)

## Quick Start (WSL)

```bash
cd /Little-Town/backend
bun install
```

`bun run dev` is the default and creates `.env` for you from `.env.example` the first
time it runs (see [Environment layout](#environment-layout) below) — no manual copy
needed.

First-time setup — starts Supabase, resets the DB, applies migrations, builds, and runs the API:

```bash
bun run dev:reset
```

After the first setup, use:

```bash
bun run dev
```

The API will be available at `http://localhost:8081`.

## Environment layout

**TEAM-BRIEF.md Sprint 16, Track A.** Three incidents (Sprint 14 real Discord ingestion
from a local backend, Sprint 15 a local `bun run dev` writing to prod, a 2026-07-28
debugging session reading live prod data locally) traced back to the same cause:
`backend/.env` used to point at the hosted **production** Supabase project by default, so
any casually started local backend talked to prod. That's fixed:

| File | Purpose | Committed? |
| --- | --- | --- |
| `.env` | Local dev config — local Supabase URL, no real Discord token. Loaded by default. | No (gitignored) |
| `.env.example` | Template for `.env`, safe placeholders. | Yes |
| `.env.production` | **Real** production credentials (hosted Supabase service-role key, real Discord bot token, JWT secret). Loaded **only** by `bun run dev:remote`. | No (gitignored) |
| `.env.production.example` | Template for `.env.production`, placeholders only. | Yes |

### Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | **Default.** Runs `dev-local.sh`: starts local Supabase, exports its URL/key into the process env (dotenv doesn't override already-set vars), builds, and runs the API against the **local** stack. |
| `bun run dev:reset` | Same as `dev`, but also wipes and re-applies local DB migrations first (`dev-local.sh --reset`). |
| `bun run dev:remote` | **Deliberate escape hatch.** Runs `dev-remote.sh`: requires typing `yes-hit-prod` to confirm, loads `.env.production`, sets `ALLOW_REMOTE_DB=true`, then runs the API against the **real hosted production** Supabase project. Only use this on purpose. |
| `bun run dev:raw` | Bare `nodemon` — reads `.env` directly with no local-stack export step. Used internally by `dev-local.sh`/`dev-remote.sh`; only run it yourself if you know your process env is already correct. |

### The startup guard

`src/config/envGuard.ts` (`assertEnvironmentSafety()`, called first thing in
`src/index.ts`) is the backstop: it throws with an actionable message if `NODE_ENV !==
"production"` **and** `SUPABASE_URL` isn't a local address, unless `ALLOW_REMOTE_DB=true`
is explicitly set (in which case it logs a loud warning banner instead and continues).
It never throws when `NODE_ENV === "production"` (Render must boot normally).
`dev-remote.sh` sets `ALLOW_REMOTE_DB=true` for you; nothing else should.

## Local Supabase

| URL                 | Default                                                   |
| ------------------- | --------------------------------------------------------- |
| API                 | `http://127.0.0.1:54321`                                  |
| Studio (DB browser) | `http://127.0.0.1:54323`                                  |
| Database            | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Open Studio in your **Windows browser** (not inside WSL). If Chrome shows an error page, open a new tab and paste the URL manually.

```bash
bun run db:start      # Start local Supabase containers
bun run db:stop       # Stop local Supabase containers
bun run db:status     # Show local URLs and API keys
bun run db:reset      # Wipe DB and re-apply all migrations (re-seeds test users)
bun run db:push       # Push migrations to linked hosted Supabase project
```

`db:stop` keeps the database volume, so the next `db:start` comes back with the
same data. Only `db:reset` wipes it.

## Docker Desktop and WSL

The local Supabase stack is a set of Docker containers. On this project's
Windows + WSL2 setup, Docker runs inside Docker Desktop on Windows, and WSL
borrows it. `bun run dev` handles the common failures below on its own. This
section is for running and testing the stack by hand, and for when the script
gives up.

### One-time setup

Do all three. The first two are what keep this from breaking again after a
reboot ([#87](https://github.com/alcash55/Little-Town/issues/87)).

1. Docker Desktop → **Settings → General** → turn on "Start Docker Desktop when
   you sign in to your computer". Apply.
2. Windows **Settings → Apps → Startup** → make sure **Docker Desktop** is on.
   Task Manager's Startup tab can disable it separately from step 1, and either
   one being off stops it launching.
3. Docker Desktop → **Settings → Resources → WSL integration** → turn on your
   distro (e.g. `Ubuntu`). Apply, then run `wsl --shutdown` in PowerShell and
   reopen the WSL terminal.

### Start everything by hand

Run these from a WSL terminal in `backend/`, in order. Each step has a check,
so you know which layer failed.

```bash
# 1. Docker Desktop is running on Windows
tasklist.exe | grep -i "Docker Desktop.exe"
# Nothing printed? Start it, then wait 60 to 90 seconds:
cmd.exe /c start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 2. WSL can reach the Docker engine
docker info --format '{{.ServerVersion}} {{.OperatingSystem}}'
# Expect a version followed by "Docker Desktop"

# 3. The Supabase containers are up
bun run db:start
docker ps --format '{{.Names}}\t{{.Status}}' | grep little_town

# 4. The API port actually answers (this is the step people skip)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:54321/rest/v1/
# Expect 200. Anything else, see "Supabase looks up but nothing connects" below.

# 5. Run the tests and read the skip count
bun test
# Expect roughly 0 skip. Hundreds of skips means step 4 is failing.
```

To run the API by hand once the stack is up, use `bun run dev`. It reuses the
running containers rather than starting new ones.

### Poking at the database

`psql` is not installed in WSL, so run it inside the database container:

```bash
docker exec -it supabase_db_little_town_backend psql -U postgres
docker exec supabase_db_little_town_backend psql -U postgres -c 'select count(*) from bingo_players'
```

Studio at `http://127.0.0.1:54323` does the same thing in a browser.

For container logs, `docker logs --tail 50 supabase_<service>_little_town_backend`,
where `<service>` is `db`, `rest`, `kong`, `auth`, and so on. Kong is the
gateway on port 54321, so its log shows every API request that got through.

### Troubleshooting

**"The command 'docker' could not be found in this WSL 2 distro."**
Docker Desktop is not running. Do step 1 above. The message suggests turning
on WSL integration, but it prints that no matter what the cause is. Inside WSL,
`/usr/bin/docker` links into `/mnt/wsl/docker-desktop/cli-tools/`, which only
exists while the app runs. When the link is dangling, `docker` falls through to
a Windows-side script at
`/mnt/c/Program Files/Docker/Docker/resources/bin/docker` that always prints
this text. Only suspect the integration toggle if `tasklist.exe` shows Docker
Desktop running and `ls /mnt/wsl/docker-desktop/cli-tools/usr/bin/docker` finds
nothing.

**Supabase looks up but nothing connects.**
`docker ps` shows every container healthy and `db:status` prints URLs, but
`curl` against port 54321 fails with exit code 56 (connection reset) or 7.
This happens after Docker Desktop cold-starts and restarts the containers on
its own, leaving the port mapping stale. Integration tests don't fail in this
state. They skip, so `bun test` still exits 0 with hundreds of skips. Restart
the stack, which keeps your data:

```bash
bun run db:stop && bun run db:start
```

`bun run dev` does this check and restart for you.

**`db:start` says a port is already allocated.**
Another Supabase project or an old container holds 54321 to 54324. Find it with
`docker ps --format '{{.Names}}\t{{.Ports}}' | grep 5432`, and stop that
project with `bun x supabase stop --project-id <id>`.

**Docker Desktop takes focus when it starts.**
Its window opens on launch, including when `bun run dev` starts it for you.
Turning on "Start Docker Desktop when you sign in" gets that out of the way at
login.

## Hosted Supabase

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
bun run db:push
```

Set these in your hosted environment:
SUPABASE_URL=<hosted project URL>
SUPABASE_SERVICE_ROLE_KEY=<hosted service role key>

## API Endpoints

### Authentication

| Method | Path               | Auth     | Description                                   |
| ------ | ------------------ | -------- | --------------------------------------------- |
| POST   | `/api/auth/login`  | None     | Login with username + password, returns JWT   |
| GET    | `/api/auth/me`     | Required | Returns the current authenticated user        |
| POST   | `/api/auth/logout` | Required | Logout acknowledgement (client removes token) |

### Hiscores

| Method | Path                            | Auth     | Description                                     |
| ------ | ------------------------------- | -------- | ----------------------------------------------- |
| GET    | `/api/hiscores/:player`         | None     | Fetch live OSRS hiscores for a player           |
| PUT    | `/api/hiscores/:player`         | Required | Refresh hiscore data for a player               |
| GET    | `/api/hiscores/skills/list`     | None     | List of all OSRS skills (scraped from wiki)     |
| GET    | `/api/hiscores/activities/list` | None     | List of all OSRS activities (scraped from wiki) |

### Bingo

| Method | Path                          | Auth              | Description                                        |
| ------ | ----------------------------- | ------------------ | --------------------------------------------------- |
| GET    | `/api/bingo/board`            | Optional           | Active bingo board and tiles. See below.             |
| GET    | `/api/bingo/my-team-data`     | Required           | Progress for the caller's own team: players, tiles, and per-tile completion. |
| GET    | `/api/bingo/team-xp-history`  | Required           | Bucketed team XP history for the `BingoScores` chart. |
| GET    | `/api/bingo/:bingoId/conflicts` | admin, moderator | Main/side accounts of the same player gaining XP in overlapping windows. |

`GET /board` is the one bingo read route that does not require login, via
`optionalAuth` rather than the router-level `protect` every other route
below it uses. A request with no token, an invalid token, or an expired
token is always treated as anonymous, never a 401. Anonymous callers get
the same board layout, tasks, and points as any authenticated non-member;
what differs is `myTeam`, which is `null` for them and every tile's
`completedByMyTeam`/`pendingByMyTeam`, which are `false`. The per-team
lookup query never runs for an anonymous caller, so there is no path where
an anonymous request resolves to someone else's team. Response shape:

```
{ active: false }
{ active: false, ended: { name, endDate } }   // most recent bingo has ended
{ active: true,
  bingo: { id, name, boardSize },
  myTeam: { id, name } | null,
  tiles: [{ id, task, type, points, targetValue, completedByMyTeam, pendingByMyTeam }] }
```

`active` means `bingo.status === 'active'` specifically, not `draft`. See
`src/routes/bingo.ts` for the full contract history; it is a frozen public
response shape and additive-only.

### Admin

All admin routes require a valid JWT with role `admin` or `moderator`.

| Method | Path                       | Role             | Description                                 |
| ------ | -------------------------- | ---------------- | ------------------------------------------- |
| POST   | `/api/admin/bingo`         | admin, moderator | Create a new bingo                          |
| GET    | `/api/admin/bingo`         | admin            | List all bingos                             |
| PUT    | `/api/admin/bingo/:id`     | admin, moderator | Update a bingo by ID                        |
| POST   | `/api/admin/bingo/details` | admin            | Save bingo details from the setup form      |
| GET    | `/api/admin/bingo/details` | admin            | Get the current active or draft bingo       |
| POST   | `/api/admin/bingo/board`   | admin            | Save the tile board for the active bingo    |
| PUT    | `/api/admin/bingo/board`   | admin            | Replace the tile board for the active bingo |
| GET    | `/api/admin/bingo/board`   | admin            | Get the current tile board                  |
| GET    | `/api/admin/bingo/screenshots/pending`        | admin, moderator | Pending Discord screenshot submissions, each with a short-lived signed image URL |
| POST   | `/api/admin/bingo/screenshots/:id/approve`    | admin, moderator | Approve a submission; body `{ tileId, teamId }` (admin assigns which tile/team it counts for) |
| POST   | `/api/admin/bingo/screenshots/:id/deny`       | admin, moderator | Deny a submission                            |

### Discord screenshot ingest

When `DISCORD_BOT_TOKEN` and `DISCORD_SCREENSHOT_CHANNEL_ID` are both set, a discord.js gateway
client (`src/services/discordScreenshots.ts`) watches the configured channel for image
attachments. On startup it backfills the channel's last 100 messages; after that it listens live.
Each image attachment is downloaded, uploaded to the private `screenshots` Supabase storage
bucket, and inserted as a `pending` row in `bingo_submissions` (deduped on `discord_message_id`,
so re-scans are safe). Approving/denying a submission via the admin API reacts 👍/👎 on the
original Discord message, best-effort (never blocks the review).

## Authentication

Include the JWT in all protected requests:

Local dev seed users (created by `db:reset`):

| Username | Password   | Role  |
| -------- | ---------- | ----- |
| `admin`  | `password` | admin |
| `user`   | `password` | user  |

## Environment Variables

| Variable                    | Description                                                             | Required in Production |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| `NODE_ENV`                  | Environment mode (`development` / `production`)                         | Yes                    |
| `PORT`                      | Server port (default: `8081`)                                           | No                     |
| `FRONTEND_URL`              | Frontend origin for CORS (default: `http://localhost:3000`)             | Yes                    |
| `JWT_SECRET`                | JWT signing secret — server refuses to start without this in production | Yes                    |
| `ALLOW_DEV_AUTH`            | Set to `true` to enable local-dev auth bypasses (no-token admin, `dev:` passwords, fallback JWT secret). Ignored in production — never set it there. | No                     |
| `JWT_EXPIRES_IN`            | JWT expiration duration (default: `24h`)                                | No                     |
| `SUPABASE_URL`              | Supabase project API URL                                                | Yes                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service role key — never expose to the frontend    | Yes                    |
| `ALLOW_REMOTE_DB`           | Set to `true` to opt into a remote (non-`production`) `SUPABASE_URL` outside production — set for you by `bun run dev:remote`. See [the startup guard](#the-startup-guard). Never set this by hand for routine local dev. | No |
| `DISCORD_ENABLED`           | Set to `true` (or run with `NODE_ENV=production`) to allow the Discord screenshot bot to log in at all. Positive opt-in, checked before token/channel presence — required since Sprint 9 caused duplicate real-bot logins on every local start otherwise. | No |
| `DISCORD_BOT_TOKEN`         | Discord bot token for the screenshot ingest service. Optional — if unset (along with `DISCORD_SCREENSHOT_CHANNEL_ID`), or if `DISCORD_ENABLED` isn't `true`, the service logs one warning on startup and does not run; the admin screenshot review API still works. Never log this value. | No |
| `DISCORD_SCREENSHOT_CHANNEL_ID` | Discord channel ID the bot watches for screenshot attachments      | No                      |
| `LOGIN_RATE_LIMIT_MAX_OVERRIDE` | Raises the login attempt ceiling (default 10 per 15 min per IP) for a scripted end-to-end suite. Ignored in production; clamped at 300 outside it. See `middleware/loginLimiter.ts`. | No |

## Scripts

| Script                 | Description                                                                |
| ----------------------- | --------------------------------------------------------------------------- |
| `bun run dev`           | **Default.** Local-safe: starts Supabase, exports local env, builds, and runs the API (`dev-local.sh`). |
| `bun run dev:reset`     | Same as `dev`, but also resets the local DB and re-applies migrations first. |
| `bun run dev:remote`    | Deliberate opt-in to run against **real production** data (`dev-remote.sh`). Requires typed confirmation. |
| `bun run dev:raw`       | Bare `nodemon` — no local-stack export step. Used internally by the two scripts above. |
| `bun run build`         | Compile TypeScript to `dist/`                                               |
| `bun run start`         | Run the compiled server                                                     |
| `bun run db:start`      | Start local Supabase Docker containers                                      |
| `bun run db:stop`       | Stop local Supabase Docker containers                                       |
| `bun run db:status`     | Show local Supabase URLs and API keys                                       |
| `bun run db:reset`      | Wipe local DB and re-apply all migrations                                   |
| `bun run db:push`       | Push migrations to linked hosted Supabase project                           |
| `bun run test`          | Run Node.js built-in test runner                                            |

## Running tests

`bun test` runs both `tests/unit/**` (no DB required) and `tests/integration/**`
(needs a reachable Supabase target). Integration suites never read plain
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — those are the hosted prod
project's credentials once bun auto-loads `backend/.env`, and integration
tests must never be able to silently hit production. Instead
`tests/integration/helpers.ts` resolves a target in this order:

1. `TEST_SUPABASE_URL` + `TEST_SUPABASE_SERVICE_ROLE_KEY`, if **both** are
   set — an explicit override (e.g. CI without the Supabase CLI, or a
   disposable test project).
2. Otherwise, the local stack via `bun x supabase status` (the default —
   just run `bun run db:start` first, no env vars needed).
3. If neither resolves (or the resolved URL doesn't respond), every
   integration suite skips cleanly — `bun test` still exits 0.

A guardrail throws (fails the run, does not skip) if the resolved URL is a
`*.supabase.co` host without `TEST_SUPABASE_URL` explicitly set, as a
backstop in case the plain-env fallthrough is ever reintroduced.

```bash
bun run db:start   # start the local stack (once); then:
bun test            # unit + integration against the local stack

bun run db:stop     # integration suites skip cleanly, unit tests still run

TEST_SUPABASE_URL=http://127.0.0.1:54321 \
TEST_SUPABASE_SERVICE_ROLE_KEY=<local service_role key from db:status> \
bun test             # explicit override, e.g. in CI
```

### CI (issue #41)

`.github/workflows/ci.yml`'s `backend` job starts the local Supabase stack
itself (`bun x supabase start` — a fresh CI runner has Docker already, and a
first start on an empty volume applies every migration plus `seed.sql`, same
as `db:reset`) and points `TEST_SUPABASE_URL`/`TEST_SUPABASE_SERVICE_ROLE_KEY`
at it before running `bun test`. Chosen over a dedicated hosted Supabase
project used only for CI because it needs no secrets, no external dependency,
and no rotation discipline — the cost is a slower CI run (the stack has to
boot), which was worth it here.

Two extra guardrails beyond just setting the env vars, both landed because a
"looks green" CI run is exactly what issue #41 was about:

- A reachability check (`curl` against the local REST endpoint) runs before
  the test step and fails the job outright if the stack isn't actually up,
  rather than letting `tests/integration/helpers.ts`'s own reachability
  check quietly skip every integration test the way it's designed to for a
  developer's local machine.
- A step after the test run parses `bun test`'s own `<N> skip` summary line
  and fails the job if it's above a small buffer (10, for tests that skip
  for a real, current reason — see the workflow file's comment). This is the
  actual regression guard: it's what would have caught 287/526 skipping
  silently in the first place.
