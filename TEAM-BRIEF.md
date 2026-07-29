# TEAM-BRIEF — Sprint 16

**Theme: stop developing against production, and close the two root causes behind the 2026-07-28 bug reports.**

Two roles, run in parallel worktrees: **devops** (Track A) and **backend** (Tracks B + C).
No frontend role this sprint — no UI changes are in scope.

---

## Why this sprint exists

Three separate incidents now trace to the same root cause: `backend/.env` points at the
**hosted production Supabase project** (`faqivcgrhrvuwpistivp`), so a casually started local
backend talks to prod.

1. Sprint 14 — QA's backend logged in the **real** Discord bot and ingested 12 real screenshots.
2. Sprint 15 — Alex's local `bun run dev` hot-reloaded the new lifecycle code and **wrote to prod**,
   completing the "yes sir" bingo early. Proven to write, not just read.
3. 2026-07-28 — a debugging session read live prod data from a local frontend, and could
   trivially have written to it.

`backend/.env` and `credentials.json` are correctly gitignored, so **nothing is leaking into git**.
The hazard is entirely local: the default developer command points at prod.

Sprint 16 fixes that, plus the two defects reported 2026-07-28, both of which are currently
running on **patches, not root fixes**.

---

## Interface contract between the two tracks

Both tracks need to touch startup. To keep them out of each other's way:

- **devops** creates `backend/src/config/envGuard.ts`, exporting exactly:

  ```ts
  /** Throws if this process is about to talk to a remote DB outside production. */
  export function assertEnvironmentSafety(): void;
  ```

- **backend** owns `backend/src/index.ts` and adds the call as the first statement after
  `import "dotenv/config"`, before any other import side effects:

  ```ts
  import { assertEnvironmentSafety } from "./config/envGuard.js";
  assertEnvironmentSafety();
  ```

Code against this signature from the start; do not wait for the other agent.

### File ownership — do not edit files owned by the other track

| devops owns | backend owns |
| --- | --- |
| `backend/.env`, `.env.example`, `.env.production.example` | `backend/src/index.ts` |
| `backend/.gitignore` | `backend/src/services/completionEngine.ts` |
| `backend/dev-local.sh` | `backend/src/services/scrapeWiki.ts` |
| `backend/package.json` (scripts only) | `backend/src/services/staticDataCron.ts` |
| `backend/src/config/envGuard.ts` (new) | `backend/src/db/staticData.ts` |
| `backend/src/services/discordScreenshots.ts` | `backend/src/routes/hiscores.ts` |
| `backend/tests/unit/envGuard.test.ts` | `backend/src/middleware/**` |
| `frontend/.env.production`, `frontend/.env.example` | all other `backend/tests/**` |
| `frontend/package.json` (scripts only) | |
| `backend/README.md`, `frontend/README.md` | |

---

## Track A — devops: environment safety

### A1. Separate local defaults from production credentials

- `backend/.env` becomes **local-stack-safe**: `SUPABASE_URL=http://127.0.0.1:54321`, the local
  service-role key, and **no real Discord bot token**.
- Real production values move to `backend/.env.production` (gitignored, never committed).
  Add `backend/.env.production.example` documenting every key with placeholder values.
- Confirm `.gitignore` covers `.env.production`. Verify with `git status --porcelain` and
  `git check-ignore -v` that no real secret becomes trackable.
- **Alex's current `backend/.env` holds the only local copy of the prod credentials.** Do not
  destroy them: copy to `backend/.env.production` first, verify, then rewrite `.env`.

### A2. `bun run dev` must default to the local stack

`bun run dev` runs nodemon, which reads `.env` — that is the unsafe default path.
`dev-local.sh` is already safe (it exports local values into the process env, and `dotenv` does
not override already-set vars), but nothing forces developers through it.

- Make the default `dev` script target the local stack.
- Keep an explicit, obviously-named escape hatch for the rare "point dev at prod" case.
- Fix two existing bugs in `dev-local.sh`: its `--help` text says `scripts/dev-local.sh` (the file
  lives at `backend/dev-local.sh`) and it copies `env.example` (the file is `.env.example`).

### A3. Startup guard — `backend/src/config/envGuard.ts`

The real backstop. `assertEnvironmentSafety()`:

- Throws with a loud, actionable message when `NODE_ENV !== "production"` **and** `SUPABASE_URL`
  is not local (not `localhost` / `127.0.0.1`).
- Escape hatch: a single explicit opt-in var (suggest `ALLOW_REMOTE_DB=true`) suppresses the
  throw and logs a prominent warning banner instead. Requiring someone to type that is the
  entire point — it makes prod access deliberate.
- Never throws when `NODE_ENV === "production"` (Render must boot normally).
- Unit tests in `backend/tests/unit/envGuard.test.ts`: local URL passes; remote URL in dev throws;
  remote URL in dev with the opt-in warns and passes; remote URL in production passes.

### A4. Env-gate the Discord bot

Open since Sprint 9. `discordScreenshots.ts` logs in the real shared bot on **every** local start,
causing duplicate bot logins and (in Sprint 14) real ingestion into a local stack.

- Only log in when an explicit flag (suggest `DISCORD_ENABLED=true`) is set, or when
  `NODE_ENV === "production"`.
- Log clearly when skipped, so it never looks like a silent failure.
- Note the Sprint 14 finding: `env -u DISCORD_BOT_TOKEN` does **not** work, because dotenv refills
  unset keys from `.env`. The gate must be a positive flag check, not an absent-token check.

### A5. `frontend/.env.production` foot-gun

`frontend/.env.production` hardcodes `VITE_BASEURL=https://little-town.onrender.com`, so a local
`bun run build` + `preview` silently drives **real prod**. Add a preview script that forces
`VITE_BASEURL` to localhost, or otherwise make the prod target explicit. Document it.

### A6. Documentation

Update `backend/README.md` (and `frontend/README.md` for A5) with the new env layout, how to run
against local, and how to deliberately opt into remote. Short and skimmable.

---

## Track B — backend: one vocabulary, not two

### The defect

Board Builder's autocomplete is fed by `scrapeWiki.ts` (the **RuneScape wiki** API page). The
completion engine matches tile task text against names from the **hiscores lite API**, via player
snapshots. These are two different vocabularies that happen to mostly agree.

Verified 2026-07-28 against a live snapshot — they diverge in exactly 2 of 115 names:

| Board Builder offers | Hiscores actually returns |
| --- | --- |
| `runecrafting` | `Runecraft` |
| `cal'varion` | `Calvar'ion` |

An admin picked `runecrafting` from the autocomplete — a legitimate suggestion — and got a tile
that could **never** auto-complete, plus an overview error telling them to retype it to match a
vocabulary that never offered the correct spelling.

Currently patched with an explicit alias table (`HISCORE_NAME_ALIASES` in `completionEngine.ts`).
That patch works and is tested, but the drift is **unbounded**: the wiki can rename anything at
any time, and nothing detects it.

### B1. Make the hiscores the single source of truth

Serve the Board Builder's vocabulary from the same names the completion engine matches on, so a
name that can be picked is always a name that can resolve.

Every OSRS account returns the identical skill/activity name list from the hiscores lite API
(only values differ), so any successful player lookup yields the authoritative vocabulary — the
completion engine already relies on exactly this property in `buildHiscoreVocab()`.

Preserve the current behaviour of `/api/hiscores/skills/list` and `/activities/list`: they return
a bare JSON array of strings, and 503 when data is not yet available. `useBoardBuilder.ts` and
`getSkills`/`getActivities` consume them unchanged — **no frontend changes in this sprint.**

Also note: `scrapeWiki.ts` points at `runescape.wiki` (**RS3**), not `oldschool.runescape.wiki`.
That is the likely source of the drift; correct it whatever approach you take.

### B2. Detect drift instead of hoping

Add a check that diffs the served vocabulary against the authoritative hiscores names and
**warns loudly** with the specific differing names. Natural homes: the static-data refresh path
(`staticDataCron.ts`) and/or `dependencyHealth.ts`, which already reports subsystem status.
A silent mismatch is the exact failure mode this sprint is closing — it must be noisy.

### B3. Keep the alias table honest

Keep `HISCORE_NAME_ALIASES` as a safety net, but once B1 lands it should be redundant for these
two names. Leave a comment stating it is a fallback, not the mechanism. Do **not** delete the
existing alias tests in `backend/tests/unit/completionEngine.test.ts` — they pin real reported
behaviour and must still pass.

---

## Track C — backend: rate-limit authenticated callers by identity, not IP

### The defect

`backend/src/index.ts` limits every `/api/*` request per **IP**. The admin panel polls on two 45s
timers (`useScreenshotSubmission` — 2 requests/tick — and `useBingoOverview`), costing roughly 60
requests per 15-minute window on an idle tab. The old 100-request ceiling was exhausted before an
admin could submit, producing a 429 on `POST /api/admin/bingo/draft` with a full team draft
entered. Reported 2026-07-28.

Patched by raising the default to 1000 and skipping loopback outside production. That unblocked
it, but the **keying is still wrong**: several admins behind one office or VPN NAT share a single
bucket, and a legitimate admin session is charged against whatever else shares its IP.

### C1. Key authenticated requests on user ID

- Authenticated request → bucket per user. Unauthenticated → bucket per IP (unchanged).
- **Sequencing constraint:** the limiter is mounted at `app.use("/api/", limiter)`, which runs
  **before** `protect`, so `req.user` is not populated inside `keyGenerator`. Read and verify the
  bearer token yourself in the key generator.
- **Use `jwt.verify`, not `jwt.decode`.** Decoding without verifying would let anyone forge a
  token and deliberately exhaust another user's bucket. On any invalid/absent token, fall back to
  the IP key.
- **IPv6:** `express-rate-limit` is v7 here — use its `ipKeyGenerator` helper for IP fallback
  rather than raw `req.ip`, or IPv6 clients get keyed incorrectly.
- Leave the login (10/15min) and invite (20/15min) limiters **alone**. Those intentionally guard
  brute-force paths by IP, which is the correct keying for an unauthenticated attacker.
- Keep the dev loopback skip.

### C2. Tests

`backend/tests/unit/` — two callers with different tokens from one IP get independent buckets;
an invalid or forged token falls back to IP keying and cannot touch another user's bucket;
unauthenticated callers still key by IP.

---

## Done criteria (both tracks)

- `bunx tsc --noEmit` clean in `backend/`.
- `bun test backend/tests/unit` — no **new** failures. Baseline on current `main` is
  **4 failing / 1 error** (`getLatestBingo` ×3, `playerSnapshotCron` export error). These are
  pre-existing and out of scope; do not fix them, but do not add to them.
- New behaviour has tests that **fail without the fix** — verify this explicitly by reverting your
  change, watching the test fail, then restoring. State in your report that you did this.
- No secret values committed. `git status` clean of `.env*` files holding real credentials.
- Do not edit files owned by the other track.
- Do not run destructive commands against the hosted Supabase project. Read-only inspection is
  fine; **writes are not**, whatever the reason.

## Reporting

Report what you changed, how you verified it, and anything you found but did not fix (that goes to
the Sprint 17 candidate list). If something in this brief turns out to be wrong, say so plainly
rather than working around it silently.
