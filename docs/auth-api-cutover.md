# Auth API domain cutover for #122

Status: repo preparation only. Alex must perform and verify the live steps.
Do not mark #122 Done when this PR merges.

## Diagnosis and limits

`littletown.gay` calls `little-town.onrender.com`. A browser that blocks that
third-party cookie can accept login's 200 response but omit `authToken` on
`/api/auth/me` or `/api/admin/bingo/details`. The resulting 401 reopens login.
The unit regression reproduces a missing-cookie 401 and a valid-cookie 200.
It does not prove which protection setting caused the original report.
Confirm with the affected browser's Network and Storage inspectors. Record
whether the cookie was blocked and whether the next request carried it.
Do not copy its value into an issue, screenshot, log, or HAR attachment.

The repair uses `https://api.littletown.gay` on the same Render service.
The backend's optional `AUTH_SAME_SITE_HOST=api.littletown.gay` changes
cookie policy only on that Host. All other production hosts keep `None`.
Both hosts retain `Secure; HttpOnly; Path=/` and omit `Domain`.
The token never appears in JSON, localStorage, redirects, or query strings.

## 1. Schedule and record rollback

Alex: schedule the frontend switch between bingos. Save the current Pages
production deployment ID and `VITE_BASEURL`, plus Render's current commit
and `FRONTEND_URL`/`CORS_ORIGIN` values. Keep the existing JWT signing secret,
database, user IDs, cookie name, and token lifetime unchanged.
Do not disable or redirect the Render hostname.

Host-only cookies cannot transfer between unrelated hosts. Existing open
tabs using the old bundle retain their old cookie and API URL until their
session expires, the user logs out, or the tab reloads into the new bundle.
A fresh login on the new API host is the deliberate session migration.
There is no silent cross-host session transfer. Users whose browser already
blocks the old cookie must sign in again after switching.

## 2. Add the custom API domain

Alex: open [Render](https://dashboard.render.com/), select the API service
currently serving `little-town.onrender.com`, then Settings, Custom Domains,
Add Custom Domain. Enter `api.littletown.gay` and save.

In [Cloudflare](https://dash.cloudflare.com/), select the `littletown.gay`
zone, then DNS, Records, Add record. Add CNAME `api` targeting
`little-town.onrender.com`, with proxy status **DNS only**. Check the target
against Render's displayed service hostname before saving. Resolve conflicts
only for `api`; leave the apex/frontend records untouched. Remove conflicting
AAAA records only for this API hostname if present.

Return to Render's Custom Domains section and select Verify. Wait for domain
verification and a valid issued TLS certificate. Keep the CNAME DNS only
through acceptance testing. The Render subdomain must remain enabled.

Sources: [Render custom domains](https://render.com/docs/custom-domains) and
[Cloudflare DNS setup for Render](https://render.com/docs/configure-cloudflare-dns).
These steps concern one API subdomain; they do not require changing the
zone-wide TLS policy or moving the frontend.

## 3. Release backend support before changing the frontend

Alex: deploy the reviewed backend commit through the normal Render workflow.
In the service environment set `AUTH_SAME_SITE_HOST=api.littletown.gay`.
Keep `NODE_ENV=production` and `FRONTEND_URL=https://littletown.gay`.
Preserve other legitimate frontend origins already in `CORS_ORIGIN`.

CORS checks the calling page's origin. `https://littletown.gay` must remain
allowed on both API hosts. Adding only `https://api.littletown.gay` would not
allow requests from the app. The API origin does not need to be an allowed
browser caller unless it actually hosts a frontend.

Check both hosts' `/api/health` endpoint for 200. Check preflight without
sending credentials:

```bash
curl -i -X OPTIONS https://api.littletown.gay/api/auth/me \
  -H 'Origin: https://littletown.gay' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: content-type'
```

Expect `Access-Control-Allow-Origin: https://littletown.gay` and
`Access-Control-Allow-Credentials: true`. Repeat for the old Render host.
Verify an existing old-bundle browser session still reads `/api/auth/me`
and admin bingo details before proceeding. Unit tests cannot prove Render
preserves the incoming Host header; verify the new host's cookie attributes
in a browser before proceeding.

## 4. Switch the frontend build environment

Alex: in the Cloudflare Pages project's production build environment,
replace `VITE_BASEURL` with `https://api.littletown.gay`. Rebuild and publish
the reviewed frontend through its normal workflow. Do not point preview
builds or local development at production as part of this change.

No committed `.env.production` or Vite config edit is needed. Vite embeds
the public API base URL at build time, so a dashboard edit alone does not
change an existing bundle. Reload the deployed app and inspect Network to
verify authenticated requests use the new host.

## 5. Complete browser acceptance and keep evidence

Alex: test Firefox with default Enhanced Tracking Protection, Safari with
its normal cross-site tracking prevention, and Chrome with third-party
cookies blocked. Use a real admin account without recording credentials.
For each browser record version, date, protection setting, deployment ID,
and these outcomes:

- Login succeeds, then `/api/auth/me` and `/api/admin/bingo/details` return
  200. The expired-session modal does not reopen.
- Network shows the API requests go to `https://api.littletown.gay` with
  credentials. Storage shows host-only `authToken`, `SameSite=Lax`, `Secure`,
  `HttpOnly`, and path `/`.
- Reload and a second tab keep the session. Logout clears the new host's
  cookie; a later `/api/auth/me` returns 401.
- An old tab still using the old bundle and its existing cookie works on
  the Render host until the planned refresh. Login there still issues
  `SameSite=None; Secure; HttpOnly`. Blocking third-party cookies may still
  prevent old-host sessions, as before this change.
- Review Render `[auth]` diagnostics. `no_token` indicates an omitted cookie;
  `verify_failure`, `token_expired`, and `invalid_claims` indicate token
  failures; `user_not_found` indicates a missing account. `lookup_error`
  with a bounded database error code accompanies a retryable 503, not a
  false expired-session 401. Do not deliberately disrupt production to test it.

Old and new hosts hold independent sessions. Logging out on one host does
not revoke a JWT still held by the other. Keep this transition window short
and communicate the planned fresh login. Do not add a browser-readable token
bridge to avoid the login step.

Cookie behavior reference: [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

## Rollback and completion

If new-host login or cookie attachment fails, restore the recorded Pages
`VITE_BASEURL` and previous deployment. Keep the Render hostname, JWT secret,
and old cookie policy intact. Existing old-host cookies can resume where the
browser permits them. Users with only a new-host cookie will need to log in
again. Do not delete either domain or rotate secrets as rollback steps.

Keep #122 in Testing after repo merge until Alex records the domain/TLS,
production base URL, old-session compatibility, and all browser checks above.
Before merge use In progress or the board's review state. No live verification
has been performed by this implementation task.
