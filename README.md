# [Little Town](https://littletown.gay)

A web app for tracking [OSRS Bingo Competitions](https://www.youtube.com/watch?v=MF6LjbPVFtA) — community events where teams race to complete tasks mapped across a bingo board in Old School RuneScape.

## What It Does

- Displays the active bingo board with team progress
- Shows hiscores pulled live from the OSRS API
- Tracks scores and team data throughout the competition
- Provides an admin panel for setting up and managing bingo events

## Tech Stack

|                | Technology                                |
| -------------- | ----------------------------------------- |
| **Frontend**   | React, TypeScript, MUI, Vite, Bun         |
| **Backend**    | Node.js, Express, TypeScript              |
| **Database**   | Supabase (Postgres)                       |
| **Auth**       | JWT with role-based access control        |
| **Deployment** | Cloudflare (frontend), Render (backend)   |

## Repository Structure

Little-Town/
frontend/ React SPA — bingo board, scores, team data, admin panel
backend/ Express API — auth, bingo management, OSRS hiscore integration

## Pages

| Route                              | Description                            |
| ---------------------------------- | -------------------------------------- |
| `/`                                | Home                                   |
| `/BingoBoard`                      | The active bingo board                 |
| `/BingoScores`                     | Team scores and leaderboard            |
| `/BingoRules`                      | Competition rules                      |
| `/TeamData`                        | Per-team hiscore data                  |
| `/AdminPanel/BingoDetails`         | Set up a new bingo event               |
| `/AdminPanel/BoardBuilder`         | Build the tile board                   |
| `/AdminPanel/TeamDrafter`          | Draft and manage teams                 |
| `/AdminPanel/ScreenshotSubmission` | Submit screenshots for tile completion |

Admin panel routes require login with an `admin` or `moderator` account.

## Local Development

Both the frontend and backend need to be running locally. See each package's README for full setup instructions:

- [`frontend/`](./frontend/) — Vite dev server on `http://localhost:3000`
- [`backend/`](./backend/) — Express API on `http://localhost:8081`

**Backend requires WSL2 and Docker Desktop.** Do not run backend commands from Git Bash or PowerShell.

Both packages need `bun install` before their scripts, including tests and
`tsc --noEmit`, will work. Quick start:

```bash
# Terminal 1 — Backend
cd backend
bun install
bun run dev:reset   # first time: starts Supabase, resets the DB, builds, and runs the API
bun run dev         # after that

# Terminal 2 — Frontend
cd frontend
bun install
bun run dev
```

See [`backend/README.md`](./backend/README.md) and
[`frontend/README.md`](./frontend/README.md) for environment variables and
the full script list.

## Links

- **OSRS Bingo explained:** https://www.youtube.com/watch?v=MF6LjbPVFtA
