# services

Business logic layer between routes and the database. Files here orchestrate multi-step operations, call external APIs, or contain logic that is too complex to live in a route handler but does not belong in the data access layer.

## Files

(This README predates most files actually in this directory — e.g. `hiscores.ts`, `scrapeWiki.ts`,
`staticDataCron.ts`, `playerSnapshotCron.ts`, `bingoActivation.ts` — none of which are documented
below.)

### `discordScreenshots.ts`
Discord gateway ingest for bingo screenshot submissions. Env-optional: does nothing but log one
warning if `DISCORD_BOT_TOKEN` / `DISCORD_SCREENSHOT_CHANNEL_ID` are unset. When configured,
watches the channel for image attachments, uploads them to the `screenshots` storage bucket, and
inserts `bingo_submissions` rows (deduped on `discord_message_id`). `startDiscordScreenshotService`
/ `stopDiscordScreenshotService` follow the same start/stop pattern as the cron services.
`reactToSubmissionMessage` is called by `routes/admin.ts` on approve/deny (best-effort).