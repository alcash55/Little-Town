
# Epics (Alex)

- Create Admin page for sending or generating links to onboard new users
-   Create onboarding wizard for first time users
- [x] Start the bingo submission page, have it pull images from the bucket that is in supabase or cloudflare *(shipped 2026-07-07 — admin review page pulls signed URLs from the private Supabase bucket; needs Discord credentials + prod migrations to go live, see action items)*
  - [x] Create an API that uses the discord api that pulls messages from a text channel in the littletown discord and POSTs them to the storage bucket
  - [x] If an admin approves the screenshot is will react to the image with a thumbs up and then add the points to that teams board and related stats
  - [x] If an admin denies the screenshot it will react to the image with as thumbs down
- Finish the resource page that includes many tips, strats, screenshots, tiles, and how tos for different oses content with info from the Little Town discord text channel #resources You'll likely need to use the discord api so I can you can see the text channel. Pull the data into a markdown file that I can trim out un-needed stuff and then we can go from there.
- [x] Create an admin page that can manually trigger the re-running of cron jobs etc. *(shipped 2026-07-09, Sprint 4 — /AdminPanel/Maintenance page with Run buttons for static-data refresh and player-snapshot refresh, per-job loading + dismissible result states, browser-verified)*
  curl -X POST http://localhost:8081/api/admin/static-data/refresh \
   -H "Authorization: Bearer <your_token>"
- Upgrade the frontend styled component library to the latest version of MUI, then audit each page to ensure no bugs/issues
  - Migrate away from victory charts and use the MUI charts instead
- Bingo overview:
  - [x] The number of players seems to not be working *(fixed 2026-07-09, Sprint 3 — the stat card read the always-empty playerStats list instead of the real roster; now shows the actual player count, browser-verified)*
  - There should be a section for seeing the health of any APIs/DBs/Renderer/cloudflare we use to make sure there isn't any downtime/outages. ex. https://status.supabase.com/
  - The overall dashboard does not look very good and should be updated in the design and overall layout, this should look like it was designed by an extemely high up senior designer that includes many beautiful and easy to read data visalizations
- [x] Select/Autocomplete bug where the options and the background are all white ot light gray and you cannot see what the options are because the contrast is bad *(fixed 2026-07-09, Sprint 3 — root cause: darkTheme never set `palette.mode: 'dark'`, so portaled menus fell back to MUI light-mode white paper under forced white text; fixed app-wide in layout/Theme, browser-verified)*
- [x] Supabase issues on all tables: Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created *(fixed 2026-07-09, Sprint 3 — explicit deny-all policies for anon/authenticated on all 10 public tables, applied to prod)*
- The team drafter and the cron jobs for updating stats needs to go in depth a little more. One thing they both do not check is if the user changed their runescape name. We only check that at the beggining of adding a user the team drafter/bingo after that they could change it many times over and we would never know. If the cron job finds a user who did change their name is should log that as well.
- [x] warning in the chrome dev tools: You are loading @emotion/react when it is already loaded. Running multiple instances may cause problems. This can happen if multiple versions are used, or if multiple builds of the same version are used. *(addressed 2026-07-09, Sprint 3 — only one physical @emotion copy exists and the warning never reproduced across ~20 scenarios; added the standard `resolve.dedupe` guard to vite.config.ts. Reopen if it reappears.)*

# Next sprint — carried over from the July 2026 audit sprint

- [x] **Stale unique constraint is load-bearing (found 2026-07-07)** *(resolved 2026-07-09, Sprint 3 — `upsert_player_hiscore_start/current` RPCs target the partial indexes via ON CONFLICT ... WHERE; stale constraint dropped in the same migration after the RPCs; side-account snapshots are now storable. Applied to prod, tested for primary/side coexistence.)*

- [x] **Submission player attribution** *(resolved 2026-07-09, Sprint 3 — `bingo_submissions.player_id` FK added, admin assigns the player at review via a new picker next to tile/team, `/my-team-data` dropStatus reads player_id instead of misreading submitted_by.)*
- Promote the local `appColors` palette in `TeamData.tsx` into `layout/Theme` once the pending theme rework lands (TODO comment marks the spot).
- [x] Implement or remove the two admin endpoints BingoOverview expects but that don't exist *(resolved 2026-07-09, Sprint 3 — `player-stats` implemented (rsn/team/tiles/points/lastSeen/sideAccounts; `minutesOnline` dropped, no data source) and wired with polling; `conflicts` REMOVED from the UI — the online-overlap data it assumed doesn't exist. Follow-up below.)*
- **Side-account conflict detection (follow-up):** now that side-account snapshots are storable, design real conflict detection (e.g. main + side gaining XP in overlapping snapshot windows) and reintroduce the overview section. Replaces the removed `/bingo/conflicts` stub.
- [x] **Integration tests silently target the hosted prod DB (found 2026-07-09)** *(fixed 2026-07-09, Sprint 4 — helpers now default to the local stack, honor only explicit `TEST_SUPABASE_URL`/`TEST_SUPABASE_SERVICE_ROLE_KEY`, skip cleanly when neither is present, and throw if a `*.supabase.co` host resolves without the explicit override)*
- Decide activation semantics when snapshots fail: today a bingo activates even if every OSRS hiscore lookup failed, leaving players without start snapshots (their deltas read zero until re-registered). Consider blocking activation below a snapshot success threshold, or a "retake missing start snapshots" admin action.
- `/api/hiscores/:player` is an unauthenticated OSRS proxy — decide whether it should require auth or stay public with its own rate limit.
- [x] Tests: the repo has zero automated tests. Seed a minimal suite around the drift-prone spots this sprint exposed (status transitions, snapshot idempotency, team replacement). *(shipped 2026-07-07 — 57 tests covering the audit's fragile spots)*

# Screenshot review page — frontend follow-ups (audited 2026-07-08, ordered by impact)

- [x] No polling/auto-refresh *(done 2026-07-09, Sprint 3 — 45s poll, paused when tab hidden or a review/refresh is in flight; same contract on BingoOverview)*
- [x] Disabled Approve button is nearly invisible against the dark card *(done 2026-07-09, Sprint 3 — visible disabled styling + inline "Pick a tile and team to approve." hint, browser-verified)*
- [x] Team/board fetch errors are swallowed *(done 2026-07-09, Sprint 3 — dismissible warning Alert, distinct from the fatal page error)*
- [x] No `onError` on the screenshot `<img>` *(done 2026-07-09, Sprint 3 — falls back to the "Image unavailable" placeholder; next successful poll restores fresh signed URLs)*
- [x] Review errors persist with no dismiss *(done 2026-07-09, Sprint 3 — Alerts now closable per submission)*
- Zoom affordance (`OpenInNewIcon`) only appears on `:hover`, never keyboard focus (`ScreenshotCard.tsx:71-96`).
- Hardcoded `#2A9D8F`/rgba colors across both files — fold into the theme-promotion item above when the theme rework lands.
- Timestamps via `toLocaleString` with no timezone label (`ScreenshotCard.tsx:23-24`) — ambiguous for a multi-timezone admin team.
- Empty state is one line of muted text (`ScreenshotSubmission.tsx`) — deserves a real empty-state treatment.

*(Done 2026-07-08: Refresh button now disables and shows a spinner + "Refreshing…" with `aria-busy` on the list while re-fetching — verified in-browser.)*

# Action items (Alex) — unblock the shipped pipeline

- [x] ~~Reset the Supabase DB password and run `db push` for~~ the three pending prod migrations (audit fixes, service-role grants, screenshot submissions) — *applied 2026-07-08 via the Supabase management API instead; password reset not needed. Verified live: new columns, indexes, 4 RPCs, private `screenshots` bucket. Note: remote migration history recorded auto-timestamped versions, so a future CLI `db push` would still see the local files as unapplied — `supabase migration repair` first if that route is ever used.*
- [x] Create the Discord bot and set `DISCORD_BOT_TOKEN` + `DISCORD_SCREENSHOT_CHANNEL_ID` in `backend/.env` — *done 2026-07-08; Bingo-Bot#9861 logs in.*
  - [x] Grant Bingo-Bot access to the test channel #portfolio-interactions — *done 2026-07-08; backfill scanned the channel and ingested a test image end-to-end (bucket upload → pending submission → working signed URL).*
  - [x] Add the two Discord env vars to Render — *done 2026-07-08; prod deploy verified live (new endpoint 401s, health 200).*
  - [ ] After testing wraps: switch `DISCORD_SCREENSHOT_CHANNEL_ID` (local + Render) from #portfolio-interactions to the real screenshots channel, and make sure Bingo-Bot can view it.
- [ ] Fix WSL SSH for good: `~/.ssh` lives on the Windows mount so permissions are permanently broken and every push needs a temp-key workaround. Move keys to real ext4 (or set `core.sshCommand` to a wrapper).
