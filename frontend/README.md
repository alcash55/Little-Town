# Little Town Frontend

React + TypeScript SPA (Vite, MUI) for the Little Town bingo app.

## Setup

```bash
cd frontend
bun install
cp .env.example .env
```

`bun install` is required before any script below, including `bun run test`
and `bun run typecheck`, will run. Use Node.js 22.12 or later for this tooling.

Edit `.env` and set `VITE_BASEURL` to the backend API URL (`http://localhost:8081` for
local dev — see [`../backend/README.md`](../backend/README.md)).

## Scripts

| Script                   | Description                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`            | Vite dev server on `http://localhost:3000`. Mode is `development` — never touches `.env.production`.                                                              |
| `bun run build`          | TypeScript 7 check followed by the production Vite build. Loads `.env.production`.                                                                                |
| `bun run typecheck`      | TypeScript 7 native compiler, with no emitted files.                                                                                                              |
| `bun run preview`        | **Safe default.** Builds and serves the build locally, forcing `VITE_BASEURL=http://localhost:8081` in `local-preview` mode. Production auth checks stay enabled. |
| `bun run preview:remote` | Explicit escape hatch: builds and previews using the real `.env.production` value (the deployed prod API). Only use this deliberately.                            |
| `bun run test`           | Vitest.                                                                                                                                                           |

The native TypeScript 7 compiler is installed as `typescript-native` and
called explicitly by `typecheck`. ESLint uses the `typescript` package at
version 6 because its parser still depends on that compiler API. Use
`bun run typecheck` to check the app with the production compiler.

The sidebar filters links by the signed-in user's role in every mode.
To test admin navigation locally, run the local backend and Supabase stack
as described in [`backend/README.md`](../backend/README.md), then sign in
with the seeded admin account defined in
[`backend/supabase/seed.sql`](../backend/supabase/seed.sql).

`ProtectedRoute` still allows direct route access in Vite development mode.
That shortcut does not grant an admin role or expose admin sidebar links.
Use `bun run preview` with the local backend to test the production route
checks locally.

## Environment variables

| Variable       | Description                                                           | File                                                              |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `VITE_BASEURL` | Backend API base URL. Public (not a secret) — just the API's address. | `.env` (local), `.env.production` (real deployed API, gitignored) |

### Local previews

`bun run preview` sets `VITE_BASEURL=http://localhost:8081` and builds in
`local-preview` mode. It does not load `.env.production`. Vite still sets
`import.meta.env.PROD=true` and `DEV=false`, so production auth checks run
against the local backend.

`bun run preview:remote` builds in production mode and uses the deployed API
URL from `.env.production` or the command environment. Use it deliberately,
since requests go to the real backend.

## Deployment

Deployed to Cloudflare (Pages). `VITE_BASEURL` is set directly in the
Cloudflare Pages build environment, not read from a committed file —
`frontend/.env.production` is a local-only convenience file for developers
building/previewing a prod-like bundle on their own machine, never committed
(see `.gitignore`).

Production-mode builds fail before bundling if `VITE_BASEURL` is missing,
empty, invalid, or points to localhost or a loopback address. Set an absolute
HTTP(S) backend URL in Cloudflare Pages Settings > Variables and Secrets for
both Production and Preview. For a local production build, set it in
`frontend/.env.production` or pass it in the command environment:

```bash
VITE_BASEURL=https://little-town.onrender.com bun run build
```

`bun run dev` still accepts a local API URL. `bun run preview:remote` uses
production mode and validates the URL. GitHub CI supplies the public Render URL
only for its build check. It does not deploy or verify live login.

## Analytics

The Cloudflare Web Analytics beacon lives in
`src/utils/cloudflareAnalyticsPlugin.ts`, a Vite plugin wired into
`vite.config.ts`. It injects a `<script defer src="https://static.cloudflareinsights.com/beacon.min.js">`
tag into `index.html` for production builds only (`apply: 'build'`, Vite's
own command gate, so `bun run dev` never emits it and never pollutes the
analytics with local sessions).

It's manual rather than the Cloudflare dashboard's automatic edge injection
([#88](https://github.com/alcash55/Little-Town/issues/88)). That injection
pinned an `integrity` hash to a versionless beacon URL, so the hash went
stale the moment Cloudflare shipped a newer beacon build and the browser
logged a CORS-and-SRI-mismatch error on every single page load, for every
visitor, indefinitely. The manual snippet has:

- No `integrity` attribute. There's nothing to pin a hash against on a URL
  Cloudflare can update at will.
- `defer`, not `type="module"` (the form in
  [#109](https://github.com/alcash55/Little-Town/issues/109)'s paste).
  Module scripts fetch in CORS mode, which was the exact failure #88
  reported. `defer` gets the same non-blocking load over a plain
  `<script src>` fetch, which isn't CORS-gated.

The site token (`CF_BEACON_TOKEN` in the plugin file) is public: Web
Analytics tokens are meant to ship to every visitor's browser, so it's fine
committed in source.

**Automatic edge injection must stay off** in the Cloudflare dashboard
(Pages project or zone, Speed, Web Analytics). If it's ever turned back on,
the page loads two beacons.

### Same-site API migration

Keep the current `VITE_BASEURL` until `api.littletown.gay` has working TLS
and the backend cookie policy is ready. The production target after cutover
is `VITE_BASEURL=https://api.littletown.gay`. Set it in the Cloudflare Pages
production build environment and rebuild. A custom API hostname does not
change the frontend origin used by backend CORS.

See [the auth cutover runbook](../docs/auth-api-cutover.md). A browser cannot
copy the Render host's httpOnly cookie to the new host, so schedule the
frontend switch between events and allow a fresh login on the new host.
