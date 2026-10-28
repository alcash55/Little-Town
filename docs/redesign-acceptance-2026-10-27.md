# Redesign acceptance, 2026-10-27

Base: `dev` at `2ba67a4`. This audit extends the read-only walkthrough in
`frontend-redesign-audit.md` with local event, account, and screenshot writes.

## Test environment

The walkthrough used built frontends and the real Express API with a separate
Supabase project, `little_town_acceptance_oct27`, on ports 55321 and 55322.
The existing demo database on 54321 was preserved. Production data was not used
for test writes. Authentication checks included real login cookies and a backend
with `ALLOW_DEV_AUTH=false`.

Chromium viewports were 1280, 390, and 320 pixels wide. Both clan profiles built
successfully. Diamond Dogs received the full functional walkthrough; Little Town
also received a branding, login, and event-setup smoke check.

## Findings fixed

| Trigger | Failure | Result |
| --- | --- | --- |
| Connect an RSN during onboarding | The team step kept the profile fetched before the claim and said the member had no team. | Refetch the profile after a successful connection. The same tour now shows the assigned team. |
| Open a recovery link with a saved session, or complete a reset while signed in | The account-keyed outlet remounted recovery after its token had been removed from the URL. This lost the form or its success message. | Recovery retains its own route state through session changes. Other pages still remount when the account changes. |
| Open a 35-tile board on a narrow phone | Six columns reduced tiles to about 41 CSS pixels and made nine task labels overlap their points. | Phone boards use two columns. Both 16- and 35-tile boards passed overlap checks at 320, 390, and 1280 pixels. The 35-tile board also passed at 600 pixels. |
| Open Board Builder without a current event | The completed event's historical board appeared editable. | Show a link to event setup instead of loading the historical board. |
| Start another event with an old local draft | The unscoped browser key could restore another event's tiles. | Draft keys include the event ID. A new event starts empty, while its own unsaved draft survives reload. Saving clears only that event's draft and subsequent saves use update. |
| View a board ended early | The planned end date appeared to be the time the event actually ended. | Label it as the scheduled end date. |
| Run the recovery lock-expiry test with an explicit database URL | The test still launched the Supabase CLI and could time out resolving it. | Reuse the existing database URL resolver. |

The onboarding, recovery, draft, and ended-copy regressions failed before their
fixes. Restoring the original recovery outlet key also failed the reset-confirmation
regression. Browser measurements reproduced the mobile label overlap before the
layout change and found zero overlaps afterward.

## Page and workflow coverage

| Area | Exercised |
| --- | --- |
| Home and navigation | Clan branding, login entry points, desktop navigation, phone menu, close control, member/admin navigation. |
| Login and permissions | Invalid old password after reset, new-password login, password reveal, remembered username without a stored password, session restoration, anonymous admin rejection, and member API denials. |
| Recovery | Admin issuance for an email-less test account, password mismatch, independent reveal controls, reset, sign-out, persistent confirmation, and used-link rejection. Email request and reset also passed through an authenticated local HTTPS relay that captured the delivery payload. |
| Invites | Generate, list, single-use registration, password reveal, revoke, and used/revoked link states. |
| Onboarding | Welcome, explicit RSN lookup and connection, refreshed team, resources, finish, and reopening from the sidebar. |
| Bingo Rules | Full content at desktop and both phone widths. |
| Public board | No event, ended event, active event, anonymous view without team completion, member team highlighting, 16/35 tiles, and tile detail open/close. |
| Team Data | Real linked team and player, approved drop, matching/empty player search, and refresh. |
| Bingo Scores | Real team ranking and XP chart, including zero-XP data. |
| Resources | Matching/empty search, category hash navigation, image preview open/close, loaded images, and RuneLite clipboard confirmation. |
| Bingo Details | Create, edit, stepper review, board-size and team settings, end early, clone, typed-name deletion guard, active-event deletion, and clearing the form after deletion. |
| Board Builder | All three tile types, add/edit/remove, pointer reordering, save/reload, local clear followed by reload, 16/35-tile boards, no-event prompt, and event-scoped draft restoration/isolation. |
| Team Drafter | Track real RSNs, keyboard movement into teams, save/reload, captain selection, side-account addition, and all three tabs at desktop and phone widths. |
| RSN claims | Release, reclaim, reassignment to another account, and restoration to the member account. |
| Screenshot review | Three private local storage objects, populated images and selectors, approve, deny, legacy attribution repair, and empty queue. Approved drops appeared on the member's board and Team Data. |
| Overview | Draft preview, refusal to activate without players, activation after assignments, points/progress charts, player table, dependencies, and conflict empty state. |
| Maintenance | Static refresh trigger, player snapshot refresh, and idempotent retry of missing start snapshots. |
| Impersonation | Select member, visible banner, admin-route denial, clear, and restored admin access. |
| Fixture cleanup | API purge removed three submissions and three stored images with their event. The disposable acceptance database was then rebuilt from migrations for full-suite testing. |

All seven organizer pages were visited at desktop and both phone widths.
No document-level horizontal overflow or router error appeared. Team Drafter's
persisted selected tab required checking each tab explicitly rather than waiting
for Player Management text on every visit.

## Final local checks

- Backend: **629 passed**, zero failed or skipped, across 78 files, using Bun 1.3.14
  and the freshly rebuilt isolated database. Existing timeout limits were preserved.
- Frontend: **247 passed**, across 30 files.
- Backend and frontend typechecks passed.
- Backend build and an isolated production-only frozen install/build passed.
- Production builds passed for Little Town and Diamond Dogs with their real public API URLs.
- Lint passed with zero errors and 26 existing warnings.
- Route documentation and whitespace checks passed.

The initial backend attempt is not acceptance evidence: it ran with the wrong Bun
version and overlapped an external worktree relocation. The final run used the
stable checkout under the project and the pinned runtime.

## External acceptance and rollout

The local relay verifies the application's delivery contract, not a real email
provider or inbox. Screenshot fixtures verify storage and review, not live Discord
ingestion or reactions. Physical iPhone Safari and other browser engines were not
tested in this walkthrough. Existing issues for those checks remain open.

No migration or production configuration change is required. Merge the fixes into
dev after final-head CI passes, rerun combined acceptance, then promote dev to main
and verify the real Cloudflare and Render deployments.
