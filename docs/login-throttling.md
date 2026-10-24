# Login throttling

## Policy

Login allows 10 attempts per IP and 10 attempts per existing account in a
15-minute window. Both successful and failed attempts consume the account
budget before password verification. Success does not reset it. The next
attempt after expiry starts a fresh window. Rejected attempts do not extend
the window. This bounds distributed guessing while allowing ordinary retries.
An attacker can temporarily deny login to a known account; recovery remains
available under its separate limits.

Login trims surrounding username whitespace and keeps the existing exact,
case-sensitive lookup. It does not lowercase usernames, because existing
accounts can differ by case. The resolved user UUID is the account key, so
all identifiers accepted for that account share its budget. Other callers of
the shared account lookup keep exact username matching. Login accepts a
nonempty username of at most 100 characters and a nonempty string password.

Postgres atomically increments a capped counter per existing user. There is
at most one row per user, removed on account deletion. Unknown accounts and
malformed identifiers never create rows. Unknown users, wrong passwords,
and exhausted account budgets return the same `401` body with
`success: false` and `error: "Invalid credentials"`, without an auth cookie
or an account-specific retry header. The existing IP limiter still returns
429. This preserves the generic response contract; it does not promise
constant-time account lookup or password verification.

`LOGIN_RATE_LIMIT_MAX_OVERRIDE` applies to both budgets outside production,
with the existing maximum of 300. Non-positive or non-integer values use the
default. Production always uses 10. Database limit or account lookup failure
denies login with a fixed 503 response and a
bounded diagnostic. No username, password, cookie, raw database error, or
request URL is logged by the login path. Unknown users also check limiter
storage, so its failure returns the same 503 response for every identifier.

## Rollout

Apply `backend/supabase/migrations/20261024000100_login_account_limits.sql`
before deploying the backend. Verify service-role access to the table and
RPC, and denied access for `anon` and `authenticated`. Existing backends
ignore this additive schema. During a rolling deployment, older backends
still enforce only the IP budget, so complete the backend rollout before
claiming distributed account protection. The IP limiter remains per process.

Do not run a blind production `db push`; local and remote migration versions
need reconciliation. No production change is part of this implementation.
If the migration is missing or inaccessible, login fails closed with 503.
Rollback the backend first and retain the additive schema for a later retry.
Recovery, sessions, and passwords do not change.

After rollout, verify an approved test account shares its budget across
backend instances and can log in again after 15 minutes. Do not use a real
member's account to exhaust the budget. Production acceptance and migration
remain operator work.
