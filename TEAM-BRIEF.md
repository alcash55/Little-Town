# TEAM-BRIEF.md — Sprint 17: "Run a real bingo"

**Goal:** Alex can run repeated bingos with 10–30 Little Town players. Every failure mode a real player hits is either fixed or visible to an admin. Today he only runs bingos solo; this sprint is what makes a multi-player round survivable.

Read `CLAUDE.md` first — it is the corrected repo guide (as of 2026-07-31). The old `agents.md` is deleted; anything you remember from it about MUI v5, victory charts, `requireAuth`/`requireRole`, or `npm run local` is wrong.

---

## Prerequisites (Alex, not agents)

These block verification. Do not work around them or fake them.

1. ~~**Apply `20260715000000_rsn_claims.sql` to prod.**~~ **DONE 2026-08-01** — verified live via the management API, `public.rsn_claims` exists with RLS enabled.
2. **Switch `DISCORD_SCREENSHOT_CHANNEL_ID`** (local + Render) to the real screenshots channel.
3. ~~**Enable Docker Desktop's WSL integration.**~~ **CORRECTION 2026-08-01 — Docker is available and the local Supabase stack is running.** An earlier `docker info` probe failed and I wrongly reported the stack as down; a first `bun test` run that showed 247 skips had hit a cold `bun x supabase status`. The real numbers on main are **381 pass / 88 skip / 0 fail**. Integration tests DO run — verify against the live local stack, do not settle for mocks.
4. **Push `main` to `origin`.** `origin/main` is 11 commits behind local `main`: all of Sprint 16 and this sprint exist only on Alex's disk. This is also why Track A2's worktree forked from a pre-Sprint-16 base.

---

## Interface contracts — FIXED

Frontend builds against these. Backend implements exactly these. If a contract is wrong, **say so in your report — do not silently change it.**

All admin routes: `protect` + `authorize("admin")`. All responses follow the repo convention: success `{ success: true, data: <payload> }`, error `{ success: false, error: "..." }`.

### A1 — End a bingo early

```
POST /api/admin/bingo/:bingoId/end
  200 { success: true, data: { id, status: "complete", endedAt: ISO8601, pendingScreenshots: number } }
  404 no such bingo
  409 { success: false, error: "Bingo is not active" }   // already complete/draft — idempotent-safe, not an error state to panic on
```
Reuses the existing idempotent, race-guarded transition in `services/bingoLifecycle.ts`. Do **not** write a second transition path.

### A2 — Delete a bingo

```
DELETE /api/admin/bingo/:bingoId
  200 { success: true, data: { deleted: true, id, purged: { teams, tiles, players, submissions, storageObjects } } }
  404 no such bingo
  409 { success: false, error: "Refusing to delete an active bingo", code: "BINGO_ACTIVE" }
```
- Refuses `status='active'` unless body `{ "force": true }` AND header `X-Confirm-Delete: <bingo name>`. Both required. This is the only destructive endpoint in the codebase.
- Postgres already cascades from `bingos(id)` through teams/tiles/players/submissions (and transitively side accounts + hiscore history) — **verify** that, don't rewrite it.
- **Screenshot images in the Supabase storage bucket are NOT covered by the FK cascade.** Deleting the rows orphans the objects. Purge them explicitly and report the count in `purged.storageObjects`.

### A3 — Clone a board into a new draft

```
POST /api/admin/bingo/clone
  body { sourceBingoId: uuid, name: string, startDate: ISO8601, endDate: ISO8601 }
  201 { success: true, data: { id, name, status: "draft", tilesCloned: number } }
  404 source bingo not found
  409 { success: false, error: "An active bingo already exists" }   // uq_bingos_one_active
```
Copies board tiles only — task, type, points, targetValue, position, **and `metadata`**. **Never** copies teams, players, submissions, or snapshots.

> **Contract amended 2026-08-01 (tech lead).** The original wording omitted `metadata`. Track A2 flagged this rather than applying it silently, and the flag was correct: `metadata` carries the Board Builder's boss/monster/activity picker data, and `points`/`target_value` are *derived from* it at save time. Cloning without it would produce round-2 tiles holding a KC/XP number with no attached boss or activity — silent data loss, not cosmetic. Response shape is unchanged (`tilesCloned` is still a count), so no other track is affected.

### A4 — Admin RSN claim release / reassign

```
GET    /api/admin/rsn-claims                → { success: true, data: [{ userId, username, rsn, rsnNormalized, claimedAt }] }
DELETE /api/admin/rsn-claims/:rsnNormalized → { success: true, data: { released: true } }
PATCH  /api/admin/rsn-claims/:rsnNormalized  body { userId: uuid }
                                            → { success: true, data: { rsn, userId } }
  409 on reassign if the target user already holds a different claim (UNIQUE(user_id))
```
Admin-only. Log every release/reassign with the acting admin's id.

---

## Track A1 — `backend` agent (routes + services)

**Owns:** `backend/src/routes/`, `backend/src/services/`, `backend/tests/`
**Does NOT touch:** `backend/src/db/`, `backend/supabase/migrations/` — those are data-engineer's. Need a data-layer function? Specify it in your report; don't write it.

1. Implement A1, A2, A3, A4 exactly per the contracts above.
2. A2's guard logic is yours and it is the highest-risk code in the sprint: active-bingo refusal, the force + `X-Confirm-Delete` double gate, and a loud audit log line on every delete.
3. Tests for each route: happy path, 404, 409, the A2 guards (both halves independently), and authz (non-admin → 403).
4. Run `bun test` and `bun x tsc --noEmit` in `backend/` before reporting.

## Track A2 — `data-engineer` agent (data layer)

**Owns:** `backend/src/db/`, `backend/supabase/migrations/`
**Does NOT touch:** `backend/src/routes/`

1. **Verify the delete cascade is actually complete.** Walk every table with a path to `bingos(id)` and prove each one is reachable by cascade. Report any table that would be orphaned. Do not assume the FK graph is right because it looks right.
2. Storage-bucket purge helper for A2: list and delete screenshot objects for a bingo, return the count. This is the piece Postgres cannot do.
3. Data-layer functions for A4 (list/release/reassign claims) respecting both `UNIQUE(user_id)` and `UNIQUE(rsn_normalized)`.
4. Clone helper for A3 — set-based tile copy, not a row-by-row loop.
5. If you need a migration, coordinate the timestamp in your report — parallel worktrees have collided on auto-timestamps before (Sprint 6).
6. **No destructive migration against real data.** Local stack only. `backend/.env` targets local by design (Sprint 16 env guard); do not set `ALLOW_REMOTE_DB`.

## Track B — `frontend` agent

**Owns:** `frontend/src/`

1. **B1** — Admin controls on BingoDetails/Maintenance: End Early (confirm dialog), Delete (typed-name confirmation matching the `X-Confirm-Delete` header), Clone → new draft. Mock against the contracts above until Track A merges; mark mocks clearly.
2. **B2** — Team Drafter: release/reassign a claimed RSN (A4); flag pool entries never claimed by a real user.
3. **B3** — TeamData's "Unassigned" empty state gets a CTA that opens the onboarding "Show intro" wizard. **This is the highest-value item in the track** — without it real players land on an empty page with no idea that confirming their RSN is what lights everything up.
4. **B4** — Board Builder bugs: (a) `titleTypographyProps` reaching the DOM (MUI v5→v9 leftover), (b) the boss/monster/minigame autocomplete not clearing after Add Tile — a real data-entry hazard, wrong tile lands silently, (c) the source-map console error.
5. **B5** — TeamData: no vertical scroll inside the table on tablet and desktop.
6. Verify in a real browser with the Playwright MCP tools. **Caveat:** the Playwright MCP may still fail to launch in WSL (unapplied fix, `Dev Projects/Fix - Playwright MCP browser launch (WSL Chromium)` in Alex's vault). If it errors, say so plainly in your report and fall back to driving cached Chromium via the playwright library — **do not report UI work as browser-verified if you never got a browser.**
7. Run `bun run test` and `bun x tsc --noEmit` in `frontend/`.

---

## Done criteria

- [ ] A1–A4 implemented to contract, with tests, non-admin gets 403 on all of them
- [ ] Delete cascade proven complete, including storage objects — with the walk documented
- [ ] A2 cannot delete an active bingo without both the force flag and the confirm header
- [ ] B1–B5 shipped and browser-verified (or explicitly reported as unverified with the reason)
- [ ] `bun test` + `tsc --noEmit` clean on both sides
- [ ] Full dress rehearsal passes: invite → accept → onboarding RSN claim → drafter assignment → board highlights → Discord drop screenshot → admin approve → KC/XP auto-verify → **end early → delete → clone into round 2**

## Rules

- Report contract problems; don't unilaterally change a contract another role is building against.
- Read neighbouring code before writing new code — match existing patterns.
- Never send auth or secret-handling code through the local Ollama model.
- Do not report anything as verified that you did not actually run. A skipped test is not a passing test — this repo has 247 backend tests that silently skip without Docker, and several sprints reported "NNN/0" while the integration layer never ran.
</content>
