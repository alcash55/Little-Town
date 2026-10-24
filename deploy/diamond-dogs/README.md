# The Diamond Dogs instance

This is a separate deployment of the same app. It has its own Supabase
project, accounts, events, storage and session secret. It does not enable
multiple clans inside one backend. Little Town keeps its existing hosting
and database.

The frontend and API share one Render web-service origin. Render assigns
its temporary `onrender.com` URL; do not assume the service name guarantees
an exact hostname. `RENDER_EXTERNAL_URL` configures both the built API URL
and the runtime frontend origin. Matching requests use host-only
`SameSite=Lax; Secure; HttpOnly` cookies.

## Prepared database

The independent Supabase project is `qslzzyhdjmvsbumoopcw`, named
Diamond Dogs Bingo, in `us-east-1`. The initial schema was applied from the
30 reviewed migrations through `20261024000100_login_account_limits.sql`.
No local seed, fixture accounts, events, or Little Town data were copied.
The initial schema is recorded as `diamond_dogs_initial_schema`; reconcile
that baseline before future migration pushes. Never run a blind `db push`.

The requested first administrator is `lucky buck2`. Bootstrap credentials
and the first-password setup link belong in a private operator record,
never in this repository or a PR. A setup link is single-use and expires
in one hour. Issue it only when the app is reachable. The username contains
an internal space and is accepted by login; new member invite usernames
still follow the existing stricter registration rules.

## Render configuration

Create a new Blueprint from this repository using
`deploy/diamond-dogs/render.yaml`, rather than the root Blueprint for the
Little Town API. The separate service uses the free instance plan. Its cold
start and resource limits still apply. Do not select an upgrade or change
the existing Little Town service as part of this setup.

Supply only the new project's `SUPABASE_SERVICE_ROLE_KEY`. The Blueprint
generates an independent JWT secret. Do not copy Little Town environment
groups, Discord tokens, recovery relay secrets or database keys. No service
role key or password belongs in a `VITE_` variable.

The build script installs frontend build dependencies, builds the
Diamond Dogs profile, and compiles the backend after a production-only
frozen install with Bun 1.3.14. The start script derives the first-party
origin from Render, serves the built SPA and refuses the known Little Town
database. `INSTANCE_SUPABASE_PROJECT_REF` and `SUPABASE_URL` must match.

The profile replaces the app title, navigation, welcome, onboarding,
invite copy and new-event placeholder. It uses a neutral bingo favicon,
hides Little Town gang icons and its Discord invite, and omits Little Town analytics. The current
theme and shared OSRS guide content remain until clan-specific content is
supplied. Strapi is not installed or required for this independent instance.

## Separate Discord and recovery setup

No Discord bot token or screenshot channel is configured. Screenshot
intake therefore remains disabled. Set up a bot and channel for Diamond
Dogs separately, then configure that bot's token and channel ID only on
this service. `DISCORD_ENABLED=false` alone does not disable production
intake if token/channel are later supplied; absence of those credentials
is what keeps this initial deployment disconnected.

Email delivery also remains disabled until an approved recovery relay is
configured. The admin fallback and first-password link work without email.
See [account recovery](../../docs/account-recovery.md).

## Acceptance

- The temporary URL loads The Diamond Dogs title, home and navigation on
  desktop and mobile, without Little Town logos or its analytics beacon.
- Direct navigation to `/BingoBoard`, `/recover` and admin routes serves
  the SPA. Missing assets and API routes remain 404s, not app HTML.
- The first admin sets a password using the private setup link, logs in,
  and can load admin details. The cookie is host-only, Lax, Secure and
  HttpOnly. Requests stay on the same origin.
- The new database has only the intended admin and no events until the
  clan creates one. Little Town accounts cannot authenticate here, and
  each service is configured with a different database and JWT secret.
- A new draft, invite and member login work, and Discord intake stays
  disabled until its own channel is configured. Do not use Little Town
  member accounts or its Discord channel to test the new instance.

Hosting, Discord credentials and first-password acceptance must be
verified live before calling the new instance ready for clan use.
