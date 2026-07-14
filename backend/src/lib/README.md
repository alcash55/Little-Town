# lib

Shared utility modules with no dependencies on Express, the database, or any specific domain. Files here are pure helpers that can be imported by any other layer (routes, middleware, services, db).

## Files

### `jwt.ts`
Exports `getJwtSecret()` — a single source of truth for the JWT signing secret. Reads from `JWT_SECRET` env var, throws in production if missing, and returns a local fallback in development. Import this instead of accessing `process.env.JWT_SECRET` directly so the safety check is never bypassed.

### `rsn.ts`
RSN canonicalization (Sprint 11, Track A), shared by `routes/onboarding.ts` and `db/rsnClaims.ts`.
`canonicalizeRsn` trims/collapses whitespace and treats `_` as a space (display form, capitalization
preserved); `normalizeRsn` lowercases on top of that (the identity/uniqueness key); `isPlausibleRsn`
is a cheap shape check (1-12 chars, letters/digits/spaces/hyphens) run before any hiscores network
call. See the file header for why the OSRS hiscore lite endpoint can't be used as a source of true
canonical capitalization.