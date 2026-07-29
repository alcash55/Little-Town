# services

Business logic layer between routes and the database. Files here orchestrate multi-step operations, call external APIs, or contain logic that is too complex to live in a route handler but does not belong in the data access layer.

## Files

(This README predates most files actually in this directory — e.g. `hiscores.ts`,
`staticDataCron.ts`, `playerSnapshotCron.ts`, `bingoActivation.ts` — none of which are documented
below.)

### `hiscoreVocab.ts`
(TEAM-BRIEF.md Sprint 16, Track B — "one vocabulary, not two".) Fetches the authoritative
skill/activity name list straight from the real OSRS hiscores lite API (via `hiscores.ts`, probing
a well-known always-ranked RSN) rather than scraping a wiki page. `staticDataCron.ts` uses this as
the sole source for the Board Builder's `/api/hiscores/skills/list` / `/activities/list`
vocabulary, so a name the Board Builder offers is always a name `completionEngine.ts`'s
`buildHiscoreVocab()` can resolve — both now come from the same API. Replaces the old
`scrapeWiki.ts` (removed this sprint), which scraped `runescape.wiki` — RS3, not OSRS — and
diverged from the real hiscores names on 2 of 115 skills/activities in practice.

### `discordScreenshots.ts`
Discord gateway ingest for bingo screenshot submissions. Env-optional: does nothing but log one
warning if `DISCORD_BOT_TOKEN` / `DISCORD_SCREENSHOT_CHANNEL_ID` are unset. When configured,
watches the channel for image attachments, uploads them to the `screenshots` storage bucket, and
inserts `bingo_submissions` rows (deduped on `discord_message_id`). `startDiscordScreenshotService`
/ `stopDiscordScreenshotService` follow the same start/stop pattern as the cron services.
`reactToSubmissionMessage` is called by `routes/admin.ts` on approve/deny (best-effort).

### `completionEngine.ts`
The single tile-completion engine (TEAM-BRIEF.md Sprint 13, Track A — "one completion engine, one
source of truth"). Kill Count/Experience tiles auto-complete for a team when the team's summed
member deltas (main + side accounts, current − start) reach `target_value`; Drops tiles complete
from an approved `bingo_submissions` row, as before. `computeCompletion` is pure (unit-testable);
`computeBingoCompletion` is the DB-touching orchestrator that `routes/bingo.ts` (`/board`,
`/my-team-data`) and `db/playerStats.ts` (`getTeamStats`) all call instead of each re-deriving
completion themselves. A trackable tile whose task can't be matched to a hiscore skill/activity
name lands in `unresolvableTiles` and never auto-completes for anyone. See the file's header
comment for the full dedupe rationale (why a legacy approved submission on a now-trackable tile
can never double-count against the auto-verified total).