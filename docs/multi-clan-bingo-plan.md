# Multi-clan bingo and Strapi plan

Planning deliverable for [issue #90](https://github.com/alcash55/Little-Town/issues/90), "Strapi.js + white labeling implementation". Researched on 2026-10-24 against `dev` commit `ed755aa1365751d80acfdd034d5a48706f7fb423`. Released `main` commit `2759b6336cbe6165fd39a66132e1927a54cab253` has identical files.

The issue requests different bingos for different clans and Strapi content management. It has no comments or further acceptance criteria at the time of research. This document proposes a design and ordered implementation PRs. It does not implement multi-clan support or authorize installing, deploying, or connecting Strapi to production.

## Recommendation and limits

Keep bingo transactions in the existing Express API and Supabase database. Use Strapi 5 as a separate, optional source of published editorial content. Add a clan boundary to the application before enabling concurrent events. Start with one active bingo per clan, subject to product approval.

Preserve the deployed Little Town site, URLs, sessions, data and default presentation throughout the transition. A CMS outage must not stop board reads, screenshot review, scoring, login or recovery. No new branding, billing, self-service clan creation or provisioning system is part of this plan.

The compact vault note at `C:\Users\Alex\Documents\Obsidian Vault\Dev Projects\Little-Town\Little-Town.md` and the project note directory contain no matches for Strapi, white-label or multi-tenant decisions. The note records migration-history timestamp mismatches and manual production migration handling. That is evidence to reconcile migration history before any future rollout, not permission to apply migrations. No vault or board changes accompany this work.

No executable spike accompanies this plan. Repository tracing establishes the single-event constraints. Official documentation establishes Strapi's runtime and extension points. A mock tenant resolver would not prove database isolation, editor permissions or session behavior. A future CMS evaluation should answer the concrete uncertainty of editor isolation against a pinned, disposable Strapi instance before clan editors receive access.

## Current implementation and assumptions

Source links below refer to files in this repository at the researched commit. Comments and README descriptions sometimes lag implementation, so route handlers and migrations determine behavior.

### Event selection and ownership

[`db/bingos.ts`](../backend/src/db/bingos.ts) selects the newest row with status `active` or `draft` in `getActiveBingo()`. Despite its name, this is not an active-only query. A newer draft can hide an older active event. The public board rejects a selected draft and returns its empty state. `getLatestBingo()` selects the newest event of any status. Neither selector accepts a clan. `listBingos()` and `getBingoById()` also have no tenant boundary.

The public [`bingo` router](../backend/src/routes/bingo.ts) resolves the event, then `getActiveBingoBoard()` independently resolves it again. An event switch between those reads can mix event metadata and tiles. The same pattern appears in team data. Resolving one event ID once per request is a useful first change before tenancy.

[`20260706000000_audit_fixes.sql`](../backend/supabase/migrations/20260706000000_audit_fixes.sql) creates `uq_bingos_one_active` on the constant `true` for active rows. The database permits only one active bingo globally. Its `activate_bingo` RPC catches uniqueness conflicts. [`clone_bingo`](../backend/supabase/migrations/20260801000000_clone_bingo.sql) separately refuses to clone while any event is active. Replacing only the index would leave these application and RPC assumptions intact.

The [initial schema](../backend/supabase/migrations/20260522000000_initial_schema.sql) has `bingos.created_by`, but no clans, clan membership or tenant ownership columns. Creator attribution is not an authorization grant. Teams, tiles and submissions reference a bingo. [`bingo_players`](../backend/supabase/migrations/20260526000001_bingo_players.sql) are event-scoped. Snapshots and [side accounts](../backend/supabase/migrations/20260601000000_side_accounts.sql) inherit their event through a player.

### Identity, membership and permissions

Authentication currently uses application-managed users and bcrypt hashes in Supabase `public.users`, with application-signed JWTs. It does not use Supabase Auth sessions. [`auth.ts`](../backend/src/routes/auth.ts), [`db/users.ts`](../backend/src/db/users.ts), [`lib/session.ts`](../backend/src/lib/session.ts) and [`middleware/auth.ts`](../backend/src/middleware/auth.ts) implement login, an HttpOnly cookie, bearer fallback, session-version revocation and database role lookup. Preserve this system. Do not substitute Strapi Users & Permissions or migrate player identities as part of #90.

Roles `admin`, `moderator` and `user` are global. The [`admin` router](../backend/src/routes/admin.ts) generally allows admins and moderators, with additional admin gates on event management and other sensitive operations. Screenshot approval, denial and tagging have different gates from historical attribution correction. The frontend [route guards](../frontend/src/components/Routes/Routes.tsx) admit only admins to the admin panel. UI access and backend permission are therefore different today. A tenant design must make those permissions explicit rather than infer them from page visibility.

`protect` sets effective and real users. Admin impersonation changes the effective user; `authorizeReal` protects the [user picker and user administration](../backend/src/routes/adminUsers.ts). These are global powers. Clan admins must not inherit global user listing, impersonation, recovery issuance, RSN ownership reassignment or infrastructure maintenance simply because their membership role is named admin.

[`rsn_claims`](../backend/supabase/migrations/20260715000000_rsn_claims.sql) represents a global user-to-RSN identity, unique by user and normalized RSN. [`resolveMyBingoPlayer`](../backend/src/db/players.ts) resolves that claim within an event, then falls back only to an unambiguous `registered_by` match. Registration records who added the player, often an admin. Neither registration nor an RSN claim proves clan membership. [`onboarding.ts`](../backend/src/routes/onboarding.ts) links the RSN to the account independently of events, and adds the caller to the globally selected event pool when one exists. [Invites](../backend/src/db/invites.ts) grant global roles and create application accounts; they carry no clan ID.

[`getDb()`](../backend/src/db/client.ts) uses the service-role key. [Deny-all RLS policies](../backend/supabase/migrations/20260709000002_deny_all_rls_policies.sql) protect against direct anonymous/authenticated database access, but the service role bypasses RLS. Tenant filtering and resource authorization must therefore happen in the API and in integrity constraints. Existing RLS is not evidence of tenant isolation.

### Scoring and background work

[`completionEngine.ts`](../backend/src/services/completionEngine.ts) is the scoring authority. Kill Count and Experience tiles use team totals from main and side-account snapshot deltas. Drops use approved submissions. Each completed tile contributes its points once per team. `computeBingoCompletion(bingoId, tiles, teamIds)` already loads event-scoped inputs. Keep its pure computation unchanged and authorize its inputs before calling it. Preserve attribution, pending flags and the rule that the board highlights only the caller's team.

[`bingo.ts`](../backend/src/routes/bingo.ts) uses the global selector for board, team data and XP history. Conflict lookup takes an explicit bingo ID with a global admin/moderator gate. [`admin.ts`](../backend/src/routes/admin.ts) includes event-ID and submission-ID operations, latest-event review queues, drafting, cloning, delete/purge, team statistics and side-account operations. All need a tenant check, including operations that already accept an explicit ID. UUIDs are identifiers, not authorization.

[`playerSnapshotCron.ts`](../backend/src/services/playerSnapshotCron.ts) refreshes a single selected event, skips activation when one active event exists, and stops its due-draft loop after the first successful activation. [`bingoLifecycle.ts`](../backend/src/services/bingoLifecycle.ts) already iterates ended active events, but its notification destination remains global. Snapshot history, conflict detection and retention must stay associated with their event when multiple clans share an RSN.

[`discordScreenshots.ts`](../backend/src/services/discordScreenshots.ts) watches one configured channel and assigns messages to the globally selected active event. Review reactions and end notifications also use that channel. [Submission storage](../backend/src/db/bingoSubmissions.ts) uses a private bucket and bingo-ID paths with signed URLs. Before concurrent events, resolve a trusted guild/channel mapping to a clan and event. Reject unmapped channels. Authorize the submission's event before generating a signed URL, mutating a review, reacting, or purging storage. Preserve message deduplication.

### Routes and content sources

[`Routes.tsx`](../frontend/src/components/Routes/Routes.tsx) has no clan segment. Public pages include `/`, `/Resources`, `/BingoBoard`, `/invite/:token` and `/recover`. Rules, scores and team data require a session. Admin pages sit under `/AdminPanel`. Frontend API calls select a deployment-wide `VITE_BASEURL`; they do not carry tenant context. The public board uses optional authentication and exposes no team completion to anonymous callers.

Content is distributed across these sources:

- [Home](../frontend/src/components/Pages/Home/Home.tsx), [gang icons](../frontend/src/components/Pages/Home/gangIcons.ts), [app shell](../frontend/src/components/AppShell) and onboarding contain Little Town copy and assets.
- [BingoRules](../frontend/src/components/Pages/BingoRules/BingoRules.tsx) embeds text and instructional images. Event rules may need a frozen published revision so editing copy cannot silently change an ongoing competition's agreed rules.
- [`resources.json`](../frontend/src/data/resources.json) is the hand-edited resource library, consumed by [`useResources`](../frontend/src/components/Pages/Resources/useResources.ts). Its [data README](../frontend/src/data/README.md) documents import/regeneration behavior and media. Do not run the Discord importer over edited content during migration.
- [Theme tokens](../frontend/src/layout/Theme), [global styles](../frontend/src/assets/styles), [HTML metadata](../frontend/index.html) and [image assets](../frontend/src/assets/Images/README.md) control presentation beyond page copy. Host-specific title/favicon metadata needs separate handling if hostname branding is selected.
- [Tile artwork](../frontend/src/data/bingoArt.ts), curated entity mappings and OSRS static data support game rendering and scoring vocabulary. Keep those shared application assets initially. Bingo names, dates, tile targets and points stay transactional even though they appear as text in the UI.

## Proposed tenant contract

A clan is the tenant. A bingo belongs to exactly one clan. Users remain global identities and can have separate memberships in multiple clans. A team belongs to one bingo, not directly to a user's global account.

Add `clans` with immutable UUID ID and unique normalized slug. Use a stable configured default-clan ID for the deployed Little Town entry point. Do not derive ownership from a display name, CMS document ID or request-supplied role. Add `clan_memberships` keyed by clan and user with an explicit role and revocation state. Proposed roles are member, reviewer and clan admin; final names and permissions require the product decision below.

Add `bingos.clan_id` as a foreign key through an expand/backfill phase. While rollback to the old binary remains supported, retain a database default pointing to the fixed default-clan ID so legacy event creation and the old clone RPC, which omit `clan_id`, still work. Validate and make the column non-null only after backfill and compatibility-write tests. Remove that default before enabling additional clans so a missed tenant argument fails instead of assigning the wrong owner. Initially keep child ownership through the existing bingo/player chain. Avoid copying `clan_id` to every table without a demonstrated query need. If duplicated later, enforce consistency with composite foreign keys. Enforce same-event relationships for submission tile/team/player, player team/captain, and side-account ownership. Individual UUID foreign keys alone do not prove that linked rows belong to the same event. Composite constraints or transactional RPC checks must preserve current deletion behavior, including nullable references and storage cleanup.

Request processing should resolve clan, authenticate, load membership, authorize the action, then load the resource through its clan-owned event. The public board can skip membership for its public projection. Private reads and writes require active membership. Return 401 for missing required authentication, 403 for a known clan with insufficient membership/permission, and 404 for a resource outside the selected clan. Unknown slugs/hosts return 404. Never fall back to Little Town for an explicitly unknown tenant.

Use separate selectors for active public event, editable draft and latest reviewable event, all requiring clan ID. Public active selection must use `status = 'active'`. The newer-draft masking behavior is a known compatibility decision to fix in that later PR with explicit tests, not an incidental change in the first refactor. Resolve event ID once for each request. Require clan ID on list/create/update/clone/delete operations and verify both source and destination for cloning. Initially allow cloning only within a clan.

After all readers, writers, jobs and RPCs are scoped, replace the global partial index with a unique index on `clan_id` where status is active. Update activation and clone checks in the same release. Concurrency must allow A and B to activate independently while two activations in A yield exactly one success. Keep one active event per clan unless the product brief expands.

### Role boundaries

Members can access their clan's authenticated competition views and claim their own global RSN. A claim only links to a roster after membership authorization. Reviewers can triage submissions in their clan. Clan admins can manage their clan's events and roster and grant only permitted clan roles. None can grant a global admin role or mutate another clan's users or claims.

Existing global admins remain trusted platform operators during migration. Keep those powers separate from membership role checks and audit both real and effective identities on impersonated operations. Do not create cross-clan impersonation for clan admins. Global account recovery and RSN ownership administration remain platform-only. Scope the impersonation target picker before exposing it to anyone new. Central cron controls and dependency health remain platform-only; a clan admin may request only an event-scoped refresh if later approved.

Invites need clan ownership and membership-role grants. Accepting an invite must atomically create or attach the authenticated global user and grant only that clan membership. Existing-user acceptance needs an explicit authenticated flow, not a duplicate account or an email-only account link. Preserve existing unexpired legacy invites during migration by binding them to the default clan with their current account behavior. Keep legacy global-admin issuance platform-only until that flow is retired.

### Slug and hostname choices

Recommended first multi-clan addressing is `/c/:clanSlug/...` for pages and `/api/clans/:clanSlug/...` for competition APIs. Retain current unprefixed paths as aliases for the default clan. Keep login and recovery global. Include clan context in new invite links, but validate against the invite's stored clan. A mismatched URL must not redirect a token into another membership grant.

A shared API hostname cannot identify clans from `Host` alone when every SPA calls the same `VITE_BASEURL`. Explicit API path context handles this without trusting arbitrary headers. Include clan and event IDs in content caches and any competition cache keys; include effective user/team for private data. Clear or invalidate private state on clan switch, logout and impersonation changes. Global OSRS vocabulary caches can remain shared.

Alternative addressing is a registered subdomain per clan or verified custom domains. That requires trusted host-to-clan mappings, DNS/TLS ownership, proxy-header rules, deep-link hosting, CORS and session/browser acceptance. Never accept arbitrary `Host`, `X-Forwarded-Host` or `Origin` as an authorization grant. If URL and verified host both identify a tenant, reject conflicts. Do not add a wildcard CORS allowlist or parent-domain auth cookie to simplify this.

[`lib/session.ts`](../backend/src/lib/session.ts) currently uses host-only cookies and a narrowly validated same-site API host option. The [auth cutover plan](auth-api-cutover.md) and [`config/cors.ts`](../backend/src/config/cors.ts) constrain a future hostname design. Custom-domain login cannot be assumed to work under third-party cookie restrictions. Slug addressing avoids adding that dependency to the first tenant release. No production cookie or domain configuration changes belong in this planning PR.

## Strapi compatibility and content boundary

These are current primary-source findings, not evidence of a working Little-Town integration. Recheck them when pinning the actual CMS version.

[Strapi 5 installation requirements](https://docs.strapi.io/cms/installation/cli) list Node LTS 22, 24 and 26, with PostgreSQL 14 minimum and 17 recommended. npm and pnpm are documented. Bun is not listed as a supported runtime. Little-Town's [frontend Node pin](../frontend/.node-version) is 22.22.2, but that does not establish compatibility for a new service. Pin an exact Strapi patch, supported Node version and its own lockfile after checking package engines. Run Strapi separately from the Bun/Express process.

Give Strapi its own database and restricted credentials. Do not point it at the application `public` schema or hand it the Supabase service-role key. [Database configuration](https://docs.strapi.io/cms/configurations/database) documents schema synchronization and migration settings. Letting the CMS synchronize existing bingo tables would put transactional data at risk. Supabase can remain the application database regardless of the eventual CMS host.

Strapi 5 [REST responses](https://docs.strapi.io/cms/api/rest) use `documentId` and flattened data. Relations and media need explicit population. [REST publication status](https://docs.strapi.io/cms/api/rest/status) defaults to published content when Draft & Publish is enabled; the Document Service has different defaults. The application adapter should request `status=published` explicitly and return its own validated content shape. Preview must be separately authorized and never share a public cache.

[Admin RBAC](https://docs.strapi.io/cms/features/rbac) controls CMS administrators. [Users & Permissions](https://docs.strapi.io/cms/features/users-permissions) controls Strapi's end-user identities and Content API roles. Neither establishes membership in Little-Town clans or native acceptance of the application's JWTs. [API tokens](https://docs.strapi.io/cms/features/api-tokens) grant endpoint permissions, not proven per-clan row isolation. Keep a least-privilege read token on the backend only. No CMS token belongs in Vite variables, browser code or logs.

[Policies](https://docs.strapi.io/cms/backend-customization/policies), [custom routes](https://docs.strapi.io/cms/backend-customization/routes) and [RBAC conditions](https://docs.strapi.io/cms/configurations/guides/rbac) provide extension points. They do not automatically make a shared CMS tenant-safe. Start with trusted platform editors. Before clan editors use a shared admin panel, test list/detail, create/update/delete, publish/unpublish, relation pickers, media upload/read/delete, preview, bulk actions and tenant-field reassignment. Content API route policies alone do not prove admin-panel isolation. Separate CMS instances are an alternative if shared editor isolation proves too costly, with a separate operational review.

[Deployment guidance](https://docs.strapi.io/cms/deployment) requires a built admin panel and running server. [Docker guidance](https://docs.strapi.io/cms/installation/docker) covers persistent uploads or external providers. Hosting needs durable database/media storage, backups and restore checks. Do not install Strapi into the static Cloudflare frontend or assume ephemeral Render storage is durable. This document selects no hosting plan and authorizes no infrastructure.

[Review Workflows](https://docs.strapi.io/cms/features/review-workflows) require Enterprise. [Admin SSO](https://docs.strapi.io/cms/features/sso) has plan/add-on requirements. Basic content integration must not depend on those features. The [repository license](https://github.com/strapi/strapi/blob/develop/LICENSE) distinguishes community and enterprise code. Confirm licenses and feature availability for the pinned version before adopting plugins or paid workflows.

### Content contract

Proposed CMS content includes clan home copy, rule documents, resource entries and references to approved presentation assets. Each clan-owned document needs an immutable application clan UUID, a content key, publication state and revision metadata. A shared resource library may remain bundled initially; do not silently copy Little Town material into other clans. A Strapi single type is global, so use clan-keyed collection types for per-clan content.

Keep membership, domain mappings, event status/dates, tile definitions/points/targets, roster, submissions, approvals, snapshots, scoring and audit records in Supabase. Store a rules revision reference or snapshot with each event if rules become editable. A CMS edit must not alter the completion engine or rewrite the agreed rules of an active event.

The browser should consume a narrow application content endpoint. The backend resolves clan ownership, requests only published fields, validates CMS output and caches by clan/content key/revision. It must reject documents claiming another clan and avoid forwarding browser filters, populate expressions or preview flags to Strapi. Use approved rich-text rendering, link schemes and media origins. Allow only existing supported theme tokens initially, not arbitrary CSS, HTML or JavaScript.

Bundle the current Little Town content as its fallback. For another clan, use only that clan's last-known published snapshot or a neutral unavailable state. Never show Little Town branding as a fallback for an unknown clan. CMS failure must not affect transaction routes. A later integration PR should define a bounded timeout, cache lifetime, publication invalidation and rollback to bundled default content. None of those options exists in deployed code today.

## Ordered implementation PRs

1. Bind the public board to one resolved event ID. This is the recommended first implementation PR after this design review. In `routes/bingo.ts`, reuse `getBingoBoardById(bingo.id)` after the existing selection and status check. Keep response envelopes, routes, optional authentication, current selector behavior and completion math unchanged. Add a focused regression that changes the selected event between reads and proves the response cannot combine metadata and tiles from different events. Reuse `bingo-board.test.ts` and `bingo-board-ended.test.ts` for anonymous, own-team and ended-state coverage. No migration, CMS dependency, UI change or new configuration. This establishes a safe request pattern without enabling tenants.
2. Add default-clan ownership. Depends on PR 1 and approval of membership boundaries. Add clans and memberships, backfill existing events into the default clan, and map existing users/roles through a reviewed migration rule. Preserve the old global role fields and global active-event index during compatibility. Retain the fixed default-clan database default for legacy inserts until all writers and clone RPCs supply ownership explicitly. Add scoped database APIs and integrity constraints. Do not expose a second clan or change selector semantics yet. Deliver migration assertions and a legacy-site regression suite.
3. Enforce tenant authorization and route context. Depends on PR 2 and the addressing decision. Add explicit clan routes and legacy default-clan aliases. Convert every ID-based route, invite/onboarding flow, user picker and private read/write to a checked clan/event context. Update frontend state and navigation. Separate platform powers from clan permissions. Add two-clan denial tests before exposing additional memberships. Fix active-only public selection deliberately here with a draft-over-active regression. Preserve admin draft and completed-event review workflows.
4. Enable concurrent clan events. Depends on PR 3. Convert snapshot/activation loops, clone checks, lifecycle notifications and Discord mapping. Enumerate each clan's active event with bounded concurrency and failure isolation. Keep global hiscore caches shared but snapshots event-scoped. Replace the global index only after all paths pass isolation checks. Enable a second test clan in a non-production environment. Do not ship if Discord routing is still global; either implement mapping or keep multi-clan ingestion disabled with explicit acceptance.
5. Evaluate a pinned CMS in isolation. Can run alongside PRs 2 through 4 after agreeing which content needs editing. Use a disposable database and media, no production credentials or imported private records. Verify runtime/build, document mapping, published-only reads, malformed/foreign-clan rejection and outage fallback. If clan editor access is required, prove the admin/media isolation cases above. Record evidence and remove disposable artifacts. This is the appropriate place for an executable spike if documentation leaves an uncertainty.
6. Integrate selected published content. Depends on PRs 3 and 5; multi-clan launch also requires PR 4. Add the backend content adapter and only the approved content fields. Migrate one content category at a time, beginning with home copy. Preserve bundled default content and resource IDs/media references. Add editor and browser acceptance before enabling CMS reads. Move rules/resources only with parity and revision checks. Custom domains, additional branding controls and provisioning remain separately approved work.

Do not overlap implementation work on #159 or #160. Coordinate ownership of #90 before a second agent starts an implementation PR. This planning branch changes only this document.

## Migration and rollback sequence

1. Reconcile hosted migration history with the reviewed repository sequence. Record baseline row counts, constraints, active event, scoring fixtures, private storage paths and permission grants. Take a restorable backup. Do not reset the shared local stack or run a blind production `db push`.
2. Expand the schema and backfill only the known default clan. Preserve UUIDs, existing sessions, claim uniqueness and event history. Review the membership mapping explicitly; do not infer membership for a new clan from player registrations. Verify no null/orphaned ownership and no changed scores before making ownership non-null. With the fixed default-clan database default in place, run the prior binary against the expanded local schema and prove event creation and cloning still succeed. Do not admit another clan during this compatibility phase.
3. Release compatibility code that scopes legacy paths to the default clan. Add constraints and route guards, then test additional tenant context with concurrency still disabled. All table/function grants must retain the service-role-only convention. Any integrity cleanup must be separately reviewed rather than deleting inconsistent rows silently.
4. Release scoped jobs/RPCs and the per-clan active index as one coordinated step. Remove the compatibility `clan_id` default only after every writer supplies ownership and rollback to the old binary has been retired. Pause or drain writers during that constraint transition. Verify activation races, review/purge and Discord destination selection before admitting another clan. CMS rollout remains independently reversible.
5. Enable content reads only after fallback and backup/restore acceptance. Export current content and retain bundled assets before each category cutover. A CMS schema rollback may require restoring its database and media; reverting application code does not undo schema synchronization.

During the default-clan-only compatibility phase, rollback can restore the prior application version while leaving additive tables/columns and the fixed default-clan database default in place. This claim depends on the old-binary event creation and clone tests above. After removing that default, use the scoped compatibility build for rollback even if a second clan has not started yet. Keep the global index until that safe boundary has passed. After multiple clans have active events or memberships, rolling back to an unscoped binary is unsafe: it can expose another clan's data. Disable new tenant traffic and affected jobs, retain a scoped compatibility build, and forward-fix. Do not restore the global unique index while multiple active rows exist or end/delete events automatically to make it fit. A full rollback then needs an approved event-state reconciliation and verified backup restore plan.

CMS rollback uses the content switch/fallback without changing bingo state. Tenant rollback and CMS rollback are separate procedures. No dual writes from Strapi to bingo tables are planned.

## Acceptance and evidence required

The first implementation PR needs the focused cross-event read regression, unchanged anonymous/own-team/ended-board behavior, backend tests and typecheck. Backend commands must run with `DOCKER_HOST=unix:///var/run/docker.sock`. Report skips as unexecuted integration coverage. No Supabase reset or stop is needed for this planning task.

Before multi-clan acceptance, use real local database fixtures for clans A and B:

- Concurrent activation succeeds once in each clan, while two competing activations in A yield one active row. Newer drafts do not hide active public events. Draft editing and completed-event screenshot review still work.
- Anonymous board reads expose only the chosen clan's public event and no team/pending/completed flags. A user belonging only to A cannot read B's private scores, team data, history, conflicts, roster, signed screenshots or admin lists.
- A reviewer/admin in A cannot mutate, clone, end, delete, draft, assign, refresh or purge B by substituting bingo, tile, team, player, side-account, submission or invite IDs. Cross-event links within A also fail. Verify foreign keys/RPCs and API denials, including missing tenant context.
- Membership revocation takes effect on the next authenticated request. A user in both clans gets independent roles and teams. Global RSN ownership stays unique; the same RSN's participation in two authorized events produces separate baselines and scores. Registration does not grant membership.
- Clan admins cannot grant platform roles, enumerate global users, impersonate outside the authorized scope, issue account recovery or reassign global claims. Real/effective identity logs remain correct. Legacy admin behavior survives only for explicitly retained platform operators.
- New and legacy invites preserve expiry, single-use and role limits. Existing-account acceptance cannot link accounts solely by email. A slug/token mismatch cannot grant another clan's membership.
- Snapshot failure in A does not prevent B refresh or activation. History retention respects event dates. Mapped Discord channels route to their own event, unmapped channels fail closed, duplicate messages remain idempotent, and reactions/notifications return to the correct destination. Completed events retain their review rules and frozen scoring behavior.
- The completion engine returns the same tile/points totals before and after backfill, including side-account deltas and approved Drops. Review attribution and deletion/storage purge remain confined to the event.
- Clan switching, logout and impersonation cannot reuse another user's or clan's cached state. Legacy URLs, deep links, mobile navigation and session recovery work in a real browser. If hostnames are chosen, test credentialed CORS, cookies and supported-browser restrictions on the actual origin arrangement.
- Published content matches the requested clan. Drafts/preview, relation expansion, media selectors and CMS admin operations cannot cross clans. CMS outage and malformed data use the correct fallback without changing scores or stopping login/review. Reverting content restores the previous published revision.
- The prior binary can create and clone events on the expanded default-clan-only schema during the rollback window. After compatibility removal, missing explicit ownership fails; no new-clan write falls into Little Town by default.
- Run the repository checks for changed packages and the route-documentation check if routes change. Require zero unexpected integration skips and record browser evidence for UI/session changes. Keep the existing production-only backend build check.

These are future acceptance requirements. This docs-only PR has not run these scenarios and does not satisfy full issue #90 acceptance.

## Product decisions still needed

Only these decisions block the proposed implementation boundaries:

1. Approve slug-based addressing with existing paths bound to Little Town, or require hostnames/custom domains for the first release. Hostnames add the session and operational work described above.
2. Confirm one active bingo per clan, membership eligibility and who can grant/revoke clan roles. Approve the default-clan mapping for existing users and distinguish existing platform admins from future clan admins. No billing or automatic provisioning decision is required.
3. Identify the first editable content category and who edits it. Trusted platform editors allow an initial CMS trial; clan editors require proven shared-admin isolation or a separate-instance decision. Confirm whether event rules require a frozen revision before moving them into the CMS.

The maintainer can approve this plan independently of those choices. Enabling another clan or CMS content remains dependent on the relevant decisions, implementation evidence and operational review.
