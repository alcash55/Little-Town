# TEAM-BRIEF — Sprint 9 (2026-07-13)

Tech lead: Claude (Fable 5). Scope set directly by Alex: three bingo-board follow-ups.

## Sprint goal

1. `tools/download-bingo-art.ts` moves into the BingoBoard folder; 2. Drops tiles get item images (bosses already have art, items don't); 3. the bingo board page becomes publicly viewable — no auth wall, un-authed visitors just see no team highlights.

## Environment

- Docker is running; the local Supabase stack is available — final verification must be LIVE (local stack + real backend), not mocked.
- **`backend/.env` points `SUPABASE_URL` at HOSTED PROD** (`faqivcgrhrvuwpistivp.supabase.co`). NEVER start the backend or tests against it — env-override to the local stack (`bun x supabase status` in backend/ for URL+keys). No `supabase db reset`.
- Starting the backend logs in the REAL shared Discord bot — keep backend instances short-lived, or unset `DISCORD_BOT_TOKEN` in your env overrides for local runs (do not edit `.env`).
- Stale dev servers may occupy ports 3000/8081/4173/8090/5190/8097/5199/8092/4175 — use fresh ports and confirm you're testing your own build.

## Frozen contract change (both tracks build against this)

`GET /api/bingo/board` becomes **optionally authenticated**:
- **Anonymous** (no/invalid token) → `200` with the same shape: `{ active, bingo, myTeam: null, tiles: [...] }`, every tile `completedByMyTeam: false`. Never a 401.
- **Authenticated** → behavior exactly as today (team resolution via effective user, impersonation-aware).
- All other bingo endpoints keep their current auth. Nothing about the response shape changes.

## Tracks

### Track A — backend (Sonnet) — small

1. Make `GET /api/bingo/board` match the frozen contract above. The route currently sits behind the router-level `protect` middleware in `backend/src/routes/bingo.ts` — implement optional auth for this one route only (e.g. an `optionalAuth` middleware that populates `req.user` when a valid token is present and continues anonymously otherwise; check `backend/src/middleware/auth.ts` for what exists). Careful: impersonation middleware must keep working for authed calls, and `ALLOW_DEV_AUTH` dev-bypass semantics shouldn't accidentally grant anonymous prod requests a role — trace how that flag works before touching anything.
2. Tests: extend `backend/tests/integration/bingo-board.test.ts` — anonymous request gets 200/`myTeam: null`/no completions (never 401, never another team's data), authed behavior unchanged, invalid/expired token treated as anonymous rather than 500/401. `bun test` stays at 0 failures (run against the local stack).
3. Report any security consideration you weighed (this is the first intentionally-public bingo data endpoint — say explicitly what an anonymous caller can now see: board layout, tile tasks/points, bingo name; confirm nothing player/team-identifying leaks).

### Track B — frontend (Sonnet)

1. **Relocate the art script.** Move `tools/download-bingo-art.ts` into `frontend/src/components/Pages/BingoBoard/` (Alex wants it colocated with the feature). Keep it runnable (`bun frontend/src/components/Pages/BingoBoard/download-bingo-art.ts` or a package.json script — document how). It must not break `tsc`/`vite build` from inside the app source tree — if the app tsconfig chokes on it, exclude the file in `frontend/tsconfig.json` rather than moving it elsewhere. Update every reference (the doc comment in `bingoArtEntities.ts`, `frontend/src/data/README.md`, anything else grep finds).
2. **Item images on Drops tiles.** Bosses/skills resolve art; item tasks mostly fall back to text. Fix that with a general mechanism, not more hand-curation. First understand how Drops tasks are authored: `Pages/AdminPanel/BoardBuilder/useBoardBuilder.ts` already pulls the full OSRS item mapping from `https://prices.runescape.wiki/api/v1/osrs/mapping` (name + item id) — if Drops tasks are real item names, you can resolve name → item id. Two viable designs, pick one and justify it:
   - (a) Runtime icon from the official Jagex GE sprite endpoint (`https://secure.runescape.com/m=itemdb_oldschool/obj_sprite.gif?id=<id>`) — no repo bloat, needs the mapping available client-side (cache it), graceful fallback to the text tile on 404/error (never a broken image).
   - (b) Extend the download pipeline to commit item sprites — only sane if you cap it to a bounded, deterministic set.
   Whichever you choose: the existing curated `bingoArtEntities.ts` items keep working (committed art wins over remote), unmatched tasks still fall back to the clean text tile, and item icons are small sprites — design the tile so a 32px-class sprite looks deliberate (centered icon treatment), not a stretched blur like a boss render slot.
2b. **Activity art (added by Alex mid-sprint).** Hiscores activities must resolve art too — Leagues, Deadman Mode, clue scrolls (every tier: beginner/easy/medium/hard/elite/master + generic "all"), and peers like Bounty Hunter, LMS, Soul Wars, Guardians of the Rift, Colosseum Glory. These are a bounded, deterministic set → extend the curated pipeline + `bingoArtEntities.ts` (committed assets, same as bosses). Wiki file patterns per Alex: `Leagues_icon.png` (icon style) and `Clue_scroll_(beginner)_detail.png` (detail style) — prefer `_detail.png` renders where they exist, icons otherwise. Same alias treatment ("dmm"→Deadman, "gotr"/"rifts"→Guardians of the Rift, "beginner clue"→that tier, bare "clue scroll"/"clues"→the generic entry).
3. **Public board page.** Move the BingoBoard route out of `ProtectedRoute` in `frontend/src/components/Routes/Routes.tsx` (public, like `invite/:token`). Un-authed view: full board, no highlights, plus a gentle "Log in to see your team's progress" affordance consistent with the app's patterns (not a blocking banner). Make sure `useBingoBoard`/`fetchWithAuth` sends no-token requests cleanly (no redirect-to-login side effects), the header's team/progress area degrades sensibly when `myTeam` is null vs un-authed, and navigation/sidebar visibility of the route for un-authed visitors is consistent (if the sidebar hides it for logged-out users, decide and document — deep links must work regardless).
4. Strict TS, no `any`; theme tokens only.
5. **Live verification** (local stack + real backend via env overrides): un-authed browser context sees the board with art + item icons and no highlights; authed user still sees their completions; boss art unchanged; an item-task tile shows its sprite; unmatched task still falls back; mobile 390×844. Screenshots to scratchpad, paths in report.

## Rules of engagement

- Work only in your assigned worktree; don't touch `todo.md` or this file.
- Track B may mock the anonymous-board response until Track A merges — final verification against the real thing.
- Conventional commits. NEVER add a Co-Authored-By or any attribution trailer to commits.
- Done = builds clean, tests/typecheck pass, report lists what changed/verified/deferred + a "For next sprint" list.

## Done-criteria for the sprint

All tracks merged to main, qa-reviewer pass on the merged result (live), browser verification, todo.md items checked off, this file deleted, work pushed.
