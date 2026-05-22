# Little Town Backend

A Node.js/Express backend API for the Little Town application with JWT authentication, role-based access control, OSRS hiscore integration, and a Supabase/Postgres database.

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
- npm
- WSL2 terminal (required — do not run from Git Bash or PowerShell)
- Docker Desktop with WSL2 integration enabled for your distro

> **WSL note:** Open Docker Desktop on Windows, go to Settings → Resources → WSL Integration, and toggle on your distro (e.g. Ubuntu). Then run `wsl --shutdown` in PowerShell and reopen your WSL terminal. Confirm Docker is reachable with `docker info`.

## Quick Start (WSL)

```bash
cd /mnt/c/Users/Alex/Code/Little-Town/backend
npm install
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

| URL | Default |
|---|---|
| API | `http://127.0.0.1:54321` |
| Studio (DB browser) | `http://127.0.0.1:54323` |
| Database | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Open Studio in your **Windows browser** (not inside WSL). If Chrome shows an error page, open a new tab and paste the URL manually.

```bash
npm run db:start      # Start local Supabase containers
npm run db:stop       # Stop local Supabase containers
npm run db:status     # Show local URLs and API keys
npm run db:reset      # Wipe DB and re-apply all migrations (re-seeds test users)
npm run db:push       # Push migrations to linked hosted Supabase project
```

## Hosted Supabase

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push
```

Set these in your hosted environment:
SUPABASE_URL=<hosted project URL>
SUPABASE_SERVICE_ROLE_KEY=<hosted service role key>

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login with username + password, returns JWT |
| GET | `/api/auth/me` | Required | Returns the current authenticated user |
| POST | `/api/auth/logout` | Required | Logout acknowledgement (client removes token) |

### Hiscores

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/hiscores/:player` | None | Fetch live OSRS hiscores for a player |
| PUT | `/api/hiscores/:player` | Required | Refresh hiscore data for a player |
| GET | `/api/hiscores/skills/list` | None | List of all OSRS skills (scraped from wiki) |
| GET | `/api/hiscores/activities/list` | None | List of all OSRS activities (scraped from wiki) |

### Admin

All admin routes require a valid JWT with role `admin` or `moderator`.

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/admin/bingo` | admin, moderator | Create a new bingo |
| GET | `/api/admin/bingo` | admin | List all bingos |
| PUT | `/api/admin/bingo/:id` | admin, moderator | Update a bingo by ID |
| POST | `/api/admin/bingo/details` | admin | Save bingo details from the setup form |
| GET | `/api/admin/bingo/details` | admin | Get the current active or draft bingo |
| POST | `/api/admin/bingo/board` | admin | Save the tile board for the active bingo |
| PUT | `/api/admin/bingo/board` | admin | Replace the tile board for the active bingo |
| GET | `/api/admin/bingo/board` | admin | Get the current tile board |

## Authentication

Include the JWT in all protected requests:

Local dev seed users (created by `db:reset`):

| Username | Password | Role |
|---|---|---|
| `admin` | `password` | admin |
| `user` | `password` | user |

## Environment Variables

| Variable | Description | Required in Production |
|---|---|---|
| `NODE_ENV` | Environment mode (`development` / `production`) | Yes |
| `PORT` | Server port (default: `8081`) | No |
| `FRONTEND_URL` | Frontend origin for CORS (default: `http://localhost:3000`) | Yes |
| `JWT_SECRET` | JWT signing secret — server refuses to start without this in production | Yes |
| `JWT_EXPIRES_IN` | JWT expiration duration (default: `24h`) | No |
| `SUPABASE_URL` | Supabase project API URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service role key — never expose to the frontend | Yes |

## Scripts

| Script | Description |
|---|---|
| `npm run local` | Start Supabase, export local env, build, and run the API |
| `npm run local:reset` | Same as `local` but resets the DB and re-applies migrations first |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled server |
| `npm run dev` | Run with nodemon — rebuilds and restarts on file changes |
| `npm run db:start` | Start local Supabase Docker containers |
| `npm run db:stop` | Stop local Supabase Docker containers |
| `npm run db:status` | Show local Supabase URLs and API keys |
| `npm run db:reset` | Wipe local DB and re-apply all migrations |
| `npm run db:push` | Push migrations to linked hosted Supabase project |
| `npm run test` | Run Node.js built-in test runner |