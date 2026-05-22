# services

Business logic layer between routes and the database. Files here orchestrate multi-step operations, call external APIs, or contain logic that is too complex to live in a route handler but does not belong in the data access layer.

## Files

This directory is currently empty. The following files are candidates to be moved here as the project grows:

- `hiscores.ts` (currently at `src/hiscores.ts`) — fetches and formats data from the OSRS hiscores API. This is external API orchestration and belongs here.
- `scrapeWiki.ts` (currently at `src/utils/scrapeWiki.ts`) — scrapes the RuneScape wiki using Puppeteer.