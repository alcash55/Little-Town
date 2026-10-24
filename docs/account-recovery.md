# Account recovery

Email stays optional. Members with an email use `/recover`. Members without
one ask a clan admin to verify their identity and issue a private link from
Admin panel > User invites. The admin must confirm the account username.
The backend checks the real signed-in admin even during impersonation.
Development auth bypasses cannot issue these links.

## Configuration and rollout

1. Apply `backend/supabase/migrations/20261023000000_account_recovery.sql`
   and `backend/supabase/migrations/20261024000000_account_recovery_readiness.sql`
   before deploying the backend. The migrations add tables, functions, a password-change
   trigger, and `users.session_version`. Existing sessions remain valid until
   that user's password changes. Startup calls a read-only Supabase readiness
   RPC with a five-second timeout before opening the HTTP listener or starting
   background jobs. Missing schema objects, unavailable Supabase, or denied
   access stop startup with a fixed diagnostic and exit code 1.
   Do not run a blind production `db push`:
   local and remote migration versions need reconciliation as documented in
   the project notes. This PR only tests the migration locally.
2. Set `FRONTEND_URL` to the single trusted frontend origin. Production
   requires HTTPS. Local HTTP is allowed only for localhost or 127.0.0.1.
   Links use this value, never the incoming Host header.
3. To deliver email, configure `RECOVERY_DELIVERY_URL` and
   `RECOVERY_DELIVERY_SECRET` on the backend. The URL must use HTTPS.
   Leave both unset to disable delivery. The public request response stays
   identical while delivery is disabled. No mail service, account, DNS,
   domain verification, or cookie domain cutover is enabled by this change.
4. Deploy the backend and frontend after the migration. Supply an email
   relay that implements the contract below, then complete manual acceptance.
   The repository has no existing email transport. Provider configuration and
   real inbox delivery remain operator work.

The relay receives an authenticated JSON POST:

```text
Authorization: Bearer <RECOVERY_DELIVERY_SECRET>
Content-Type: application/json

{"to":"member@example.test","url":"https://frontend.example/recover#token=...","expiresInMinutes":60}
```

Return a 2xx response only after accepting the email for delivery. Send a
plain recovery email containing the supplied URL and one-hour expiry.
Keep the URL and bearer secret out of relay, proxy, analytics, and error logs.
Disable click tracking or link rewriting that exposes the token to third
parties. Verify the relay's delivery/retry policy before enabling it.
The backend refuses redirects and stops waiting after 10 seconds. It never
logs response bodies or tokens. Tests inject an in-memory local delivery sink;
no live email is sent by tests or enabled by default.

## API and security limits

- `POST /api/auth/recovery/request` with `{email}` returns 202 and identical
  confirmation text for existing, missing, ambiguous, or email-less accounts.
  Five requests per IP per 15 minutes. Lookup and delivery start after the
  response has flushed, so neither account existence nor relay latency
  changes that response's work. Invalid email syntax returns 400.
- A database limit allows three requests per normalized email per 15 minutes,
  including unknown emails, across backend processes. Throttled accounts
  still receive the same public confirmation. Case variants share a bucket.
- `POST /api/auth/recovery/status` with `{token}` checks without consuming.
  `POST /api/auth/recovery/consume` with `{token,password}` resets. They share
  ten requests per IP per 15 minutes. Status distinguishes ready, expired,
  used and invalid for a bearer of the unguessable token only.
- `POST /api/admin/users/recovery` with `{username,confirm:true}` returns a
  link once, to a real admin only, for an account without email. Ten attempts
  per real admin per 15 minutes. The member's identity must be verified by
  the admin through an established clan contact before issuing the link.
- Request, status, consume and admin responses use `Cache-Control: no-store`.
  Public APIs never return usable links. The reset token travels in a URL
  fragment and POST body, never a URL path/query. The page removes the
  fragment immediately and keeps the token only in memory. Reload using the
  original link if needed. Opening/scanning a link does not consume it.
- Tokens have 256 bits of cryptographic randomness. Only SHA-256 digests
  are stored, appropriate for these high-entropy secrets. Passwords use the
  existing bcrypt cost 12. New recovery passwords require at least 12
  characters and at most 72 UTF-8 bytes to avoid bcrypt truncation.
- User-row locking serializes issuance and consumption. The password update,
  single use, sibling token invalidation and session-version increment run in
  one database transaction. Any other password-hash update runs the same
  invalidation trigger. Both required and optional authentication reject old
  session versions. Reset does not automatically log the member in.
- Terminal token metadata is retained up to seven days past expiry, then
  removed when that account next receives a link. Limit rows older than one day are removed
  on the next request. No raw reset token is stored in either table.

The public HTTP limiters and bounded background work queue are per process.
The email bucket and token locks are shared in Postgres. The queue holds at
most 50 jobs and is not durable: process shutdown, overload, or relay failure
can lose a request. The member can retry, subject to the same limits. No
automatic delivery retry or durable outbox is included. A newly issued link
invalidates the previous link even if delivery fails. Monitor the bounded
`[recovery] request_failed` diagnostic and relay delivery metrics.

Login retains its existing IP limit. Per-account login throttling is still
separate follow-up work from issue #62's rate-limit discussion; this PR does
not alter the login contract or impose an email migration.

## Manual acceptance before marking issue #62 done

- Configure the relay with an approved sender. Verify a real member receives
  the email, follows the link, sets a password and logs in. Confirm old
  sessions fail on both protected and optionally authenticated routes.
- Verify request confirmation, password mismatch, success, expiry, reuse,
  replacement and retry after rate limiting in supported browsers.
- Verify an admin can privately issue an email-less member's link and a
  regular member/moderator cannot, including impersonation headers.
- Verify production migration/function privileges and relay monitoring.
  Configure reverse-proxy limits for multiple backend instances if needed.

Keep the issue in Testing until configured delivery and rollout acceptance
pass. Automated local tests cannot prove real inbox delivery.
