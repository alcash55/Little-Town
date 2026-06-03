# agents.md — Little-Town

Guidelines for AI agents working in this repo. Little-Town is a full-stack OSRS Bingo Competition tracker.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, MUI v5, Vite, Bun, React Router v6, dnd-kit, Victory charts |
| **Backend** | Node.js, Express 4, TypeScript, Supabase (Postgres), JWT, bcrypt, Puppeteer |
| **Deployment** | Cloudflare (frontend), Supabase (database), Renderer (APIs) |

---

## Project Layout

```
Little-Town/
├── frontend/
│   └── src/
│       ├── components/   # Feature components (one folder per component)
│       ├── layout/       # Providers, theme, global wrappers
│       ├── utils/        # Pure utility functions
│       └── App.tsx       # Root: Providers + RouterProvider + Suspense
└── backend/
    └── src/
        ├── routes/       # One file per route group (auth, hiscores, admin, items, skills)
        ├── services/     # Business logic, external API calls (OSRS API, wiki scraper)
        ├── middleware/   # errorHandler, auth guards
        ├── db/           # Supabase client
        ├── types/        # Shared TypeScript types
        └── utils/        # Pure utility functions
```

---

## Backend Conventions

### Routes

- One file per route group in `src/routes/`. Mount in `src/index.ts` under `/api/<name>`.
- Routes stay thin — delegate business logic to `src/services/`.
- Always pass errors to `next(err)`. The central `errorHandler` middleware handles formatting.
- Response shape: success → `{ success: true, data: <payload> }`, validation errors → `res.status(400).json({ success: false, error: "..." })`.

### Auth

- Protected routes use `requireAuth` middleware, optionally followed by `requireRole(["admin"])`.
- Roles: `"admin"`, `"moderator"`, `"user"`. Decoded JWT payload is available as `req.user`.

### Supabase

- Import the client from `src/db/client.js`. Never write raw SQL outside of migration files in `supabase/`.
- Always check `error` before using `data` from Supabase queries.

### ESM Imports

All relative imports require `.js` extensions (even for `.ts` source files):
```ts
import { foo } from "../utils/foo.js"; // correct
import { foo } from "../utils/foo";    // wrong — breaks at runtime
```

### Environment Variables

- Secrets go in `.env` (copy from `.env.example`). Never commit `.env`.
- Required vars are validated at startup in `index.ts`. Add new required vars there + in `.env.example` + backend `README.md`.

---

## Frontend Conventions

### Components

- One folder per component: `src/components/MyComponent/MyComponent.tsx`.
- Named exports only: `export function MyComponent()`.
- Props interfaces defined inline or in the same file.

### Routing

- React Router v6 `createBrowserRouter` in `src/components/Router/Router.tsx`.
- Lazy-load large pages: `const MyPage = lazy(() => import('../MyPage/MyPage').then(m => ({ default: m.MyPage })))`.
- The `Suspense` boundary is already in `App.tsx` — don't add per-route ones.

### MUI v5 (planning migration to newer version)

- Use `sx` prop for one-off styles; `styled()` from `@mui/material/styles` for reusable styled components.
- Use `theme.*` tokens for colors and spacing — avoid hardcoded hex/px values.
- Import icons individually: `import CheckCircleIcon from '@mui/icons-material/CheckCircle'`.

### Drag and Drop (dnd-kit)

Used in the board builder and team drafter. Use `@dnd-kit/core` + `@dnd-kit/sortable` + `CSS.Transform.toString(transform)` for transform styles.

### Charts (Victory - Planning migration to use MUI data visalizations once updated to newer version) 

Used for score/stats views. Import from `victory`: `VictoryChart`, `VictoryLine`, `VictoryAxis`, etc.

### Dates

Uses `@mui/x-date-pickers` with `date-fns`. `LocalizationProvider` is in `Providers` — don't add it per-component.

---

## Dev Setup

**Backend requires WSL2 + Docker Desktop. Do not run backend commands from Git Bash or PowerShell.**

```bash
# Backend (WSL2 terminal)
npm run local:reset   # first-time setup
npm run local         # subsequent runs (Supabase + Express on :8081)

# Frontend (any terminal)
cd frontend
bun dev               # Vite on http://localhost:3000
```

Supabase commands: `npm run db:start` / `npm run db:reset` / `npm run db:push`.

---

## Pages

| Route | Description |
|---|---|
| `/` | Home |
| `/BingoBoard` | Active bingo board |
| `/BingoScores` | Team scores and leaderboard |
| `/BingoRules` | Competition rules |
| `/TeamData` | Per-team hiscore data |
| `/AdminPanel/BingoDetails` | Set up a new bingo event |
| `/AdminPanel/BoardBuilder` | Build the tile board |
| `/AdminPanel/TeamDrafter` | Draft and manage teams |
| `/AdminPanel/ScreenshotSubmission` | Submit screenshots for tile completion |

Admin routes require `admin` or `moderator` role.
