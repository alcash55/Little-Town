# middleware

Express middleware functions that run before route handlers. Files here deal with cross-cutting concerns like authentication, authorization, and error handling. Middleware should not contain business logic or direct database queries beyond what is needed to validate a request.

## Files

### `auth.ts`
Two middleware exports:
- `protect` — verifies the Bearer JWT on incoming requests, looks up the user in the database, and attaches them to `req.user`. Returns 401 if the token is missing, invalid, or the user no longer exists.
- `authorize(...roles)` — role guard that runs after `protect`. Rejects requests where `req.user.role` is not in the allowed list. Used to restrict admin-only routes.

### `errorHandler.ts`
Two exports:
- `AppError` — a custom Error subclass that carries an HTTP status code and optional error code string. Throw this anywhere in the app to produce a structured error response.
- `errorHandler` — Express error-handling middleware registered last in `index.ts`. Catches all errors passed to `next()`, maps known Postgres/Supabase error codes (unique violations, foreign key errors, RLS blocks etc.) and JWT errors to appropriate HTTP responses, and returns a consistent `ErrorResponse` shape.
- `asyncHandler` — wraps async route handlers so any rejected promise is automatically forwarded to `next()` without needing try/catch in every route.