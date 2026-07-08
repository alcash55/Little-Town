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
- Docker Desktop for local database development
  > **WSL note:** Open Docker Desktop on Windows, go to Settings → Resources → WSL Integration, and toggle on your distro (e.g. Ubuntu). Then run `wsl --shutdown` in PowerShell and reopen your WSL terminal. Confirm Docker is reachable with `docker info`.

## Quick Start (WSL)

```bash
cd /Little-Town/backend
bun install
cp env.example .env
```

First-time setup — starts Supabase, resets the DB, applies migrations, builds, and runs the API:

```bash
npm run local:reset
```

After the first setup, use:

```bash
npm run local
```

The API will be available at `http://localhost:8081`.

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
| `DISCORD_BOT_TOKEN`         | Discord bot token for the screenshot ingest service. Optional — if unset (along with `DISCORD_SCREENSHOT_CHANNEL_ID`), the service logs one warning on startup and does not run; the admin screenshot review API still works. Never log this value. | No |
| `DISCORD_SCREENSHOT_CHANNEL_ID` | Discord channel ID the bot watches for screenshot attachments      | No                      |

## Scripts

| Script                | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `bun run local`       | Start Supabase, export local env, build, and run the API          |
| `npm run local:reset` | Same as `local` but resets the DB and re-applies migrations first |
| `bun run build`       | Compile TypeScript to `dist/`                                     |
| `bun run start`       | Run the compiled server                                           |
| `bun run dev`         | Run with nodemon — rebuilds and restarts on file changes          |
| `bun run db:start`    | Start local Supabase Docker containers                            |
| `bun run db:stop`     | Stop local Supabase Docker containers                             |
| `bun run db:status`   | Show local Supabase URLs and API keys                             |
| `bun run db:reset`    | Wipe local DB and re-apply all migrations                         |
| `bun run db:push`     | Push migrations to linked hosted Supabase project                 |
| `bun run test`        | Run Node.js built-in test runner                                  |
