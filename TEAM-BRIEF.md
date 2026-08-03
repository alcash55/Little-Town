# TEAM-BRIEF.md — Sprint 17, phase 2: admin controls + drafter claim admin

**Read `CLAUDE.md` first.** It is the corrected repo guide. MUI is **v9**, charts are
`@mui/x-charts`, TypeScript with no `any` unless genuinely unavoidable.

Sprint 17's goal is that Alex can run repeated bingos with 10–30 real players.
Phase 1 shipped the backend (A1–A4) and three frontend items (B3/B4/B5). This
phase is the admin UI that makes those routes reachable, plus one bug that
currently locks admins out of admin pages.

**Status of phase 1 — all merged to `main`, all live:**
- `POST /api/admin/bingo/:bingoId/end`, `DELETE /api/admin/bingo/:bingoId`,
  `POST /api/admin/bingo/clone`, `GET|DELETE|PATCH /api/admin/rsn-claims`
- Backend suite: **521 pass / 0 fail / 0 skip**. Frontend: **103/103**. Both `tsc` clean.
- `bun run dev` works again in `backend/` (it was broken outright; fixed in d0f79b8).

---

## Interface contracts — FROZEN, these routes already exist

Do **not** change a route to suit the UI. If a contract is wrong, say so in your
report and build against it as written.

All are `protect` + `authorize("admin")`, mounted under `/api/admin`. Success is
`{ success: true, data: ... }`, errors `{ success: false, error: "..." }`.

### End a bingo early
```
POST /api/admin/bingo/:bingoId/end
  200 { success: true, data: { id, status: "complete", endedAt, pendingScreenshots } }
  404 { success: false, error: "No such bingo" }
  409 { success: false, error: "Bingo is not active" }
```
409 is **not** a panic state — it means the bingo was already complete/draft.
Surface it as information, not a red failure.

`pendingScreenshots` matters: it is the count of screenshots still awaiting
review at the moment the bingo ended. Show it in the success state — Alex needs
to know he has N screenshots to review, not just "ended".

### Delete a bingo
```
DELETE /api/admin/bingo/:bingoId
  body   { force?: true }
  header X-Confirm-Delete: <exact bingo name>
  200 { success: true, data: { deleted: true, id,
        purged: { teams, tiles, players, submissions, storageObjects } } }
  404 { success: false, error: "No such bingo" }
  409 { success: false, error: "...", code: "BINGO_ACTIVE" }
```
Deleting an **active** bingo requires **both** `force: true` in the body and the
`X-Confirm-Delete` header matching the bingo's name exactly. Either alone is
refused. This is the only destructive endpoint in the codebase — the typed
confirmation in the UI must be the real bingo name, and the header must carry
exactly what the user typed. Do not auto-fill it.

Show the `purged` counts in the result. "Deleted 1 bingo, 2 teams, 25 tiles,
14 players, 8 submissions, 8 images" is the confirmation Alex actually wants.

### Clone a board into a new draft
```
POST /api/admin/bingo/clone
  body { sourceBingoId, name, startDate, endDate }
  201 { success: true, data: { id, name, status: "draft", tilesCloned } }
  404 source bingo not found
  409 an active bingo already exists
```
Copies board tiles only (including `metadata`) — never teams, players,
submissions or snapshots.

### RSN claims admin
```
GET    /api/admin/rsn-claims                → data: [{ userId, username, rsn, rsnNormalized, claimedAt }]
DELETE /api/admin/rsn-claims/:rsnNormalized → data: { released: true }
PATCH  /api/admin/rsn-claims/:rsnNormalized   body { userId } → data: { rsn, userId }
  409 if the target user already holds a different claim (UNIQUE(user_id))
```

> **Known contract-shape gap, already flagged, do not "fix" it yourself:** the
> clone and rsn-claims routes forward `AppError`s through `errorHandler`, so some
> error bodies carry an extra `code` field and some don't. Read the error message
> defensively (`describeApiError` already does) and report anything that bites you.

---

## Track B1 — `frontend` agent: admin lifecycle controls + the wizard bug

**Owns:** `frontend/src/components/Pages/AdminPanel/BingoDetails/`,
`frontend/src/components/Pages/AdminPanel/Maintenance/`,
`frontend/src/components/Onboarding/`

**Does NOT touch:** `frontend/src/components/Pages/AdminPanel/TeamDrafter/` (Track B2's).

1. **End Early** — confirm dialog, then `POST .../end`. Show `pendingScreenshots`
   in the success state with a link to the review page. Handle 409 as information.
2. **Delete** — typed-name confirmation. The button stays disabled until the typed
   text exactly matches the bingo name; send that text as `X-Confirm-Delete` and
   `force: true`. Report the `purged` counts on success. This is the most dangerous
   control in the app — it should feel dangerous and be impossible to trigger by
   accident.
3. **Clone** — name + start/end date pickers (`@mui/x-date-pickers` + `date-fns`;
   `LocalizationProvider` is already in `Providers`, don't add another), then
   `POST /bingo/clone`. On success, route the admin to the new draft. Handle the
   409 "an active bingo already exists" case with a message that says what to do.
4. **B6 (BUG) — the onboarding wizard traps admins.** `OnboardingProvider`
   (`frontend/src/components/Onboarding/useOnboarding.tsx:87-96`) auto-opens for
   **any** authenticated user with no `onboarding:v1:<userId>` localStorage record,
   on **any** route, regardless of role — and an auto-open is deliberately
   non-dismissable (`dismissable: openReason === 'manual'`, so Escape and backdrop
   are both ignored). The modal intercepts every pointer event, so an admin landing
   on `/AdminPanel/BoardBuilder` cannot use or dismiss the page; the only way out is
   completing all four steps including RSN confirmation. This hits any admin created
   by direct DB insert, any admin with cleared site data, and every fresh browser
   profile. It was confirmed in a real browser on 2026-08-02 — it blocked the B4
   verification run until the record was seeded by hand.

   Fix so an admin is never forced through a player-oriented RSN flow to reach an
   admin page. **Do not** simply make auto-opens dismissable — the "must complete
   once" behaviour was a deliberate Sprint 10 decision for real players and must
   survive for them. Decide deliberately between not auto-opening on `/AdminPanel/*`
   and not auto-opening for the admin role, and **state which you chose and why in
   your report.** Add a regression test — this is exactly the kind of thing that
   silently comes back.

## Track B2 — `frontend` agent: Team Drafter claim administration

**Owns:** `frontend/src/components/Pages/AdminPanel/TeamDrafter/`

**Does NOT touch:** `BingoDetails/`, `Maintenance/`, `Onboarding/` (Track B1's).

1. **Release / reassign a claimed RSN** against the `/api/admin/rsn-claims` routes.
   Someone will fat-finger a claim, and today that locks the name until Alex edits
   the database by hand. Release needs a confirmation step; reassign needs to pick
   a target user. Handle the 409 (target user already holds a different claim) with
   a message naming the conflict rather than a generic failure.
2. **Flag pool entries never claimed by a real user.** A `bingo_players` row can
   exist with no `rsn_claims` row pointing at it — that player was typed in by an
   admin and no real account has confirmed it. Those players never see their own
   team data. Make that visible in the drafter so Alex can chase them. `GET
   /api/admin/rsn-claims` gives you the claimed set; the drafter already has the
   pool.
3. Do not invent a backend route. If you need data the existing routes don't
   expose, say so in your report.

---

## Shared local stack — read this, it has bitten past sprints

Both tracks share **one** local Supabase stack, and the schema allows only **one
active bingo** (`uq_bingos_one_active`).

- Seed with `cd backend && bun run tests/manual-seed-browser-verify.ts`. It is
  re-runnable, clears its own prior rows, refuses any non-local target, and prints
  JWTs for a linked user, an unlinked user, and an admin. It creates an active
  bingo "Browser Verify Round 1" with 16 tiles on a 25-tile board, 2 teams, 4 players.
- **Track B1 owns destructive flows.** If you end/delete/clone the fixture bingo,
  re-run the seed afterwards.
- **Track B2: re-run the seed immediately before your verification pass** rather
  than trusting whatever is in the database.
- If state vanishes mid-run, that is probably the other track, not a bug in your
  code. **Report it — do not build a workaround.**

## Browser verification — the MCP is broken, use the library directly

The Playwright **MCP** does not launch in WSL. That is **not** an excuse to report
UI work as unverified — the library and a cached Chromium are both present.

- Write a script, copy it into `frontend/` (it cannot resolve `playwright` from
  elsewhere), run `node ./.verify-tmp.mjs`, then delete it.
- Get into the app by setting **two** localStorage keys before navigating:
  - `authToken` — a JWT printed by the seed script
  - `onboarding:v1:<userId>` → `{"status":"completed"}` — **required until B1 fixes
    B6**, or the wizard modal swallows every click. Decode `<userId>` from the JWT's
    `id` claim.
- Assert on computed style and layout via `page.evaluate`, not just screenshots,
  and capture `console` + `pageerror` — that is what proves a React warning is gone.
- Your worktree needs its own `bun install` in `frontend/` (node_modules is
  gitignored and does not travel). Run Vite on your own port (`--port 3001` /
  `--port 3002`) and point it at the backend already running on `:8081`.

## Done criteria

- [ ] Every control built against the frozen contracts above, including both halves
      of the delete double-gate
- [ ] B6 fixed without regressing the "players complete the wizard once" behaviour,
      with a regression test and a stated rationale for the approach chosen
- [ ] `bun run test` and `bun x tsc --noEmit` clean in `frontend/`
- [ ] Browser-verified: **name the routes and states you actually exercised.** Work
      reported as done without that is treated as unverified.
- [ ] Report contract problems and shared-stack collisions; don't paper over them

## Rules

- Never add a `Co-Authored-By` trailer or any similar attribution to commits.
- Read neighbouring code before writing new code; match the existing patterns.
- Named exports, one folder per component, `theme.*` tokens — no hardcoded hex/px.
- Don't send auth or secret-handling code through a local Ollama model.
- Don't report anything as verified that you did not actually run.
