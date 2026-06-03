# lib

Shared utility modules with no dependencies on Express, the database, or any specific domain. Files here are pure helpers that can be imported by any other layer (routes, middleware, services, db).

## Files

### `jwt.ts`
Exports `getJwtSecret()` — a single source of truth for the JWT signing secret. Reads from `JWT_SECRET` env var, throws in production if missing, and returns a local fallback in development. Import this instead of accessing `process.env.JWT_SECRET` directly so the safety check is never bypassed.