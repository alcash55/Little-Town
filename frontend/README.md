# Little Town Frontend

React + TypeScript SPA (Vite, MUI) for the Little Town bingo app.

## Setup

```bash
cd frontend
bun install
cp .env.example .env
```

Edit `.env` and set `VITE_BASEURL` to the backend API URL (`http://localhost:8081` for
local dev — see [`../backend/README.md`](../backend/README.md)).

## Scripts

| Script                 | Description                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `bun run dev`           | Vite dev server on `http://localhost:3000`. Mode is `development` — never touches `.env.production`. |
| `bun run build`         | Production build (`tsc && vite build --mode production`) — loads `.env.production`.              |
| `bun run preview`       | **Safe default.** Builds and serves the build locally, forcing `VITE_BASEURL=http://localhost:8081` regardless of `.env.production`. |
| `bun run preview:remote` | Explicit escape hatch: builds and previews using the real `.env.production` value (the deployed prod API). Only use this deliberately. |
| `bun run test`          | Vitest.                                                                                           |

## Environment variables

| Variable       | Description                                                                | File |
| -------------- | --------------------------------------------------------------------------- | ---- |
| `VITE_BASEURL` | Backend API base URL. Public (not a secret) — just the API's address.       | `.env` (local), `.env.production` (real deployed API, gitignored) |

### The `.env.production` foot-gun (TEAM-BRIEF.md Sprint 16, Track A item A5)

`frontend/.env.production` hardcodes the real deployed backend's URL
(`https://little-town.onrender.com`). Vite's default `--mode` for `vite build`
is `production`, and `bun run preview` builds before serving — so a plain
`vite build && vite preview` used to silently drive the **real production
API** from a local preview, with no visual indication anything was different
from local dev.

`bun run preview` now overrides `VITE_BASEURL` to `http://localhost:8081`
before building (`process.env` values take priority over `.env.*` file
values in Vite, same precedence rule dotenv uses on the backend — see
`../backend/README.md`), so the default is safe. `bun run preview:remote` is
the explicit, differently-named opt-in for when you actually want to preview
a local build against the real production API.

## Deployment

Deployed to Cloudflare (Pages). `VITE_BASEURL` is set directly in the
Cloudflare Pages build environment, not read from a committed file —
`frontend/.env.production` is a local-only convenience file for developers
building/previewing a prod-like bundle on their own machine, never committed
(see `.gitignore`).
