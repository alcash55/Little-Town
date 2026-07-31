# CLAUDE.md — Little-Town

Little-Town is a full-stack OSRS Bingo Competition tracker.

**Versions go stale fast — read `frontend/package.json` / `backend/package.json` for exact versions rather than trusting a table here.** The notes below cover things you can't infer from package.json.

---

## Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript 5, **MUI v9**, Vite, Bun, React Router v6, dnd-kit, `@mui/x-charts` |
| **Backend** | Bun + Express 4, TypeScript 5, Supabase (Postgres), JWT, bcrypt, Puppeteer |
| **Deployment** | Cloudflare (frontend), Supabase (database), Render (APIs) |

MUI is **v9** (upgraded from v5 in Sprint 5) — v5-era APIs and codemod-outdated patterns are wrong here.
Charts are **`@mui/x-charts`**; `victory` was removed in Sprint 5. Never reintroduce it.

---

## Project Layout

```
Little-Town/
├── frontend/
│   └── src/
│       ├── components/   # Feature components (one folder per component)
│       │   ├── Pages/    # Route-level pages
│       │   └── Routes/   # Routes.tsx (router) + ProtectedRoute.tsx
│       ├── layout/       # Providers, theme, global wrappers
│       ├── data/         # resources.json (hand-edited source of truth)
│       ├── utils/        # Pure utility functions
│       └── App.tsx       # Root: Providers + RouterProvider + Suspense
├── backend/
│   ├── scripts/          # Discord dump tooling
│   └── src/
│       ├── routes/       # One file per route group
│       ├── services/     # Business logic, external API calls (OSRS, WOM, wiki)
│       ├── middleware/   # auth, errorHandler, rateLimitKey
│       ├── db/           # Supabase client
│       ├── types/        # Shared TypeScript types
│       └── utils/        # Pure utility functions
└── tools/                # build-resources.ts
```

---

## Backend Conventions

### Routes

- One file per route group in `src/routes/`. Mount in `src/index.ts` under `/api/<name>`.
- **Mount order matters**: more specific prefixes first (`/api/admin/invites` and `/api/admin/users` are mounted *before* `/api/admin`).
- Routes stay thin — delegate business logic to `src/services/`.
- Wrap async handlers in `asyncHandler` and pass errors to `next(err)`; the central `errorHandler` middleware formats them.
- Response shape: success → `{ success: true, data: <payload> }`, errors → `res.status(4xx).json({ success: false, error: "..." })`.

### Auth

Middleware lives in `src/middleware/auth.ts`:

| Export | Use |
|---|---|
| `protect` | Require a valid JWT. Populates `req.user`. |
| `optionalAuth` | Attach `req.user` if a token is present, but never reject. Used by public-but-personalized routes like `GET /api/bingo/board`. |
| `authorize(...roles)` | Role gate, applied after `protect`. |
| `authorizeReal(...roles)` | Role gate against the **real** user, ignoring impersonation. Use for anything an impersonated session must never reach. |
| `asyncHandler` | Async route wrapper. |

Roles: `"admin"`, `"moderator"`, `"user"`.

**Impersonation**: admins can act as another user via the `X-Impersonate-User-Id` header. `protect` resolves it into `req.user`; use `authorizeReal` when a check must apply to the actual admin. Admin-to-admin impersonation is blocked and every impersonated request is logged.

### Rate limiting

Limiters are configured in `index.ts` and keyed by identity via `middleware/rateLimitKey.ts` — not by IP alone. When adding a limiter to an authenticated route, use `rateLimitKey` so one user can't exhaust the bucket for everyone behind a shared IP.

### Supabase

- Import the client from `src/db/client.js`. Never write raw SQL outside migration files in `supabase/`.
- Always check `error` before using `data`.

### ESM Imports

All relative imports require `.js` extensions (even for `.ts` sources):
```ts
import { foo } from "../utils/foo.js"; // correct
import { foo } from "../utils/foo";    // wrong — breaks at runtime
```

### Environment Variables

- Secrets go in `.env` (copy `.env.example`). Never commit `.env`.
- Required vars are validated at startup in `index.ts`. A new required var goes in **all three**: `index.ts` validation, `.env.example`, backend `README.md`.
- `.env` is gitignored, so it does **not** travel between git worktrees — an agent working in a worktree needs it copied in by hand.

---

## Frontend Conventions

### Components

- One folder per component: `src/components/MyComponent/MyComponent.tsx`.
- Named exports only: `export function MyComponent()`.
- Props interfaces defined inline or in the same file.

### Routing

- `createBrowserRouter(createRoutesFromElements(...))` in `src/components/Routes/Routes.tsx` — JSX `<Route>` elements, not the object config form.
- Pages are re-exported through `src/components/Pages/index.ts` and referenced as `<Pages.Foo />`. Routes are **not** lazy-loaded; don't add `lazy()` to one route in isolation.
- Gate a route by wrapping it: `<ProtectedRoute allowedRoles={['admin']}>`. Public routes are left out of `ProtectedRoute` entirely rather than given a bypass role.
- The `Suspense` boundary is in `App.tsx` — don't add per-route ones.

### MUI v9

- `sx` prop for one-off styles; `styled()` from `@mui/material/styles` for reusable styled components.
- Use `theme.*` tokens for colors and spacing — no hardcoded hex/px. The dark theme sets `palette.mode: 'dark'`; portaled menus break if that's ever dropped.
- Import icons individually: `import CheckCircleIcon from '@mui/icons-material/CheckCircle'`.

### Charts

`@mui/x-charts` — `LineChart`, `BarChart`, `Gauge`. See `BingoScores.tsx`, `TeamPointsChart.tsx`, `BoardProgressGauge.tsx`, `Countdown.tsx`. Colors come from theme tokens.

### Drag and Drop (dnd-kit)

Board builder and team drafter: `@dnd-kit/core` + `@dnd-kit/sortable` + `CSS.Transform.toString(transform)`.

### Dates

`@mui/x-date-pickers` with `date-fns`. `LocalizationProvider` is in `Providers` — don't add it per-component.

### Resources page

`frontend/src/data/resources.json` is the hand-editable source of truth (see `frontend/src/data/README.md`). `tools/build-resources.ts` regenerates it from a Discord dump.

---

## Dev Setup

**Backend requires WSL2 + Docker Desktop. Do not run backend commands from Git Bash or PowerShell.**

```bash
# Backend (WSL2 terminal)
cd backend
bun run dev:reset     # first-time setup / clean slate
bun run dev           # subsequent runs (Supabase + Express on :8081)

# Frontend
cd frontend
bun run dev           # Vite on http://localhost:3000
```

Supabase: `bun run db:start` / `db:reset` / `db:push` / `db:status` (from `backend/`).

## Checks

```bash
cd backend  && bun test && bun x tsc --noEmit
cd frontend && bun run test && bun x tsc --noEmit
```

Run the checks for whichever side you touched before reporting work as done. A passing build is not proof the UI works — verify UI changes in a real browser.

---

## Pages

| Route | Access | Description |
|---|---|---|
| `/` | public | Home |
| `/Resources` | public | Guides, strats, tiles, RuneLite marker payloads |
| `/BingoBoard` | public | Active bingo board (anonymous = no team highlighting) |
| `/invite/:token` | public | Accept an invite |
| `/unauthorized` | public | Access denied |
| `/BingoRules` | user+ | Competition rules |
| `/BingoScores` | user+ | Team scores and leaderboard |
| `/TeamData` | user+ | Per-team hiscore data |
| `/AdminPanel/BingoDetails` | admin | Set up a new bingo event |
| `/AdminPanel/BoardBuilder` | admin | Build the tile board |
| `/AdminPanel/TeamDrafter` | admin | Draft and manage teams |
| `/AdminPanel/ScreenshotSubmission` | admin | Review submitted screenshots |
| `/AdminPanel/BingoOverview` | admin | KPIs, charts, dependency health |
| `/AdminPanel/Maintenance` | admin | Manually trigger cron jobs |
| `/AdminPanel/UserInvite` | admin | Generate / revoke invites |

---

## Domain notes

- **RSN changes**: every hiscore lookup for a registered player re-checks that the RSN still resolves. Misses land in `rsn_change_log`; a 404 triggers a Wise Old Man rename lookup that can auto-update `bingo_players.rsn`. Detection and logging only — never rename a player from a guess. See `services/rsnChangeDetection.ts`.
- **Hiscores vocabulary**: the codebase uses one term — `hiscores` — for the OSRS API. Don't reintroduce `highscores`.
- **Active bingo** means `status === "active"` specifically. Drafts are not active; the board shows a "No active bingo" empty state.
- **Tile completion** on the board is derived from *my team's* approved submissions only, never other teams'.

---

## Working in this repo

- `todo.md` is the running epic/story list. Check items off as they ship, with a short `_(shipped YYYY-MM-DD, Sprint N — what changed)_` note.
- Sprint scratch files (`TEAM-BRIEF.md`, `SPRINT-STATUS.md`) get deleted once the sprint merges to main.
</content>
</invoke>
