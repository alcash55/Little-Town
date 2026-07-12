# middleware

Express middleware functions that run before route handlers. Files here deal with cross-cutting concerns like authentication, authorization, and error handling. Middleware should not contain business logic or direct database queries beyond what is needed to validate a request.

## Files

### `auth.ts`
Four exports:
- `protect` — verifies the Bearer JWT on incoming requests, looks up the user in the database, and attaches them to `req.user` and `req.realUser`. Returns 401 if the token is missing, invalid, or the user no longer exists. Also applies impersonation (Sprint 6, Track A item 2): if the real caller is an admin and sends `X-Impersonate-User-Id`, `req.user` is swapped to the target user for the rest of the request (`req.realUser` always stays the actual caller). Logs `[impersonation] admin <realId> as <userId> <method> <path>` on every swap. Blocks impersonating another admin (403) or a nonexistent user (400); silently ignores the header for non-admin callers.
- `authorize(...roles)` — role guard that runs after `protect`. Rejects requests where `req.user.role` (the possibly-impersonated user) is not in the allowed list. Used to restrict admin-only routes — an impersonating admin correctly loses access here if the target isn't privileged.
- `authorizeReal(...roles)` — same as `authorize` but checks `req.realUser` instead, for the handful of admin-only routes that manage the impersonation grant itself (today: `GET /api/admin/users`) and must stay usable while an override is active.
- `LOCAL_DEV_USER_ID` — the fixed id `protect` assigns when `ALLOW_DEV_AUTH=true` bypasses the JWT check.

### `errorHandler.ts`
Two exports:
- `AppError` — a custom Error subclass that carries an HTTP status code and optional error code string. Throw this anywhere in the app to produce a structured error response.
- `errorHandler` — Express error-handling middleware registered last in `index.ts`. Catches all errors passed to `next()`, maps known Postgres/Supabase error codes (unique violations, foreign key errors, RLS blocks etc.) and JWT errors to appropriate HTTP responses, and returns a consistent `ErrorResponse` shape.
- `asyncHandler` — wraps async route handlers so any rejected promise is automatically forwarded to `next()` without needing try/catch in every route.