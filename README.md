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

This table is the source of truth for the app's routes. `CLAUDE.md` points
here instead of keeping its own copy, and `tools/check-pages-doc.ts` fails
CI if the two ever drift apart again. Verified against
[`frontend/src/components/Routes/Routes.tsx`](./frontend/src/components/Routes/Routes.tsx).

| Route                               | Access | Description                                            |
| ------------------------------------ | ------ | ------------------------------------------------------- |
| `/`                                  | public | Home                                                     |
| `/Resources`                         | public | Guides, strats, tiles, RuneLite marker payloads          |
| `/BingoBoard`                        | public | Active bingo board (anonymous = no team highlighting)    |
| `/invite/:token`                     | public | Accept an invite                                         |
| `/unauthorized`                      | public | Access denied                                            |
| `/BingoRules`                        | user+  | Competition rules                                        |
| `/BingoScores`                       | user+  | Team scores and leaderboard                              |
| `/TeamData`                          | user+  | Per-team hiscore data                                    |
| `/AdminPanel/BingoDetails`           | admin  | Set up a new bingo event                                 |
| `/AdminPanel/BoardBuilder`           | admin  | Build the tile board                                     |
| `/AdminPanel/TeamDrafter`            | admin  | Draft and manage teams                                   |
| `/AdminPanel/ScreenshotSubmission`   | admin  | Review submitted screenshots                             |
| `/AdminPanel/BingoOverview`          | admin  | KPIs, charts, dependency health                          |
| `/AdminPanel/Maintenance`            | admin  | Manually trigger cron jobs                               |
| `/AdminPanel/UserInvite`             | admin  | Generate / revoke invites                                |

`user+` accepts `user`, `moderator`, or `admin`. Admin panel routes require `admin` specifically.

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
