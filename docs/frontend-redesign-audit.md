# Frontend redesign audit

Audited locally on 2026-10-26 on `feat/white-label-redesign`. Compared the redesign with `bbca596`, the branch's original `dev` base.

Both profiles run against the same local API and database. The event name "Little Town • Redesign Demo" therefore appears in both profiles as event data. Diamond Dogs navigation, loading artwork, logo fallback, Discord availability, and analytics settings remain profile-specific.

## Fixed issues

| Area               | Finding                                                                                                                                                              | Change                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Board builder      | Four narrow columns clipped tile names and edit/remove controls beside the new editor. Black icons disappeared against dark cards.                                   | Size columns from their available space, allow titles to wrap, and use theme colors for controls.                                         |
| Homepage           | Only the first five configured gang icons survived the redesign.                                                                                                     | Restore the complete icon set with responsive wrapping; keep it disabled for Diamond Dogs.                                                |
| Desktop navigation | Hiding the menu button removed access to Discord and "Show intro" on large screens.                                                                                  | Keep the complete menu accessible alongside desktop navigation.                                                                           |
| Account menu       | Light initials had poor contrast against the gold avatar.                                                                                                            | Use the primary color's contrast text.                                                                                                    |
| Team drafter       | The last tab was partly off-screen on phones without a visible way to scroll.                                                                                        | Add scrollable tabs with mobile scroll controls.                                                                                          |
| Team drafter       | Escape cancelled the drag overlay but left the player in the new team.                                                                                               | Restore the assignments captured before the move. Verified with keyboard movement and cancellation.                                       |
| Team drafter       | The unclaimed-player tooltip replaced the player's accessible name. The drag overlay used low-contrast text.                                                         | Keep the RSN as the button name, describe the warning separately, and use contrast text on the overlay.                                   |
| Event setup        | Reducing the team count hid a name in the review but still submitted it to the API.                                                                                  | Submit only the displayed teams, with surrounding whitespace removed.                                                                     |
| Event setup        | Duplicate names reached the server instead of being caught before review.                                                                                            | Validate names case-insensitively before the review step.                                                                                 |
| Event setup        | Incomplete date input could throw `RangeError: Invalid time value`.                                                                                                  | Handle invalid picker values at the input boundary.                                                                                       |
| Event setup        | Creating an event did not load its saved identity. Another save could create a second draft, and lifecycle controls stayed unavailable.                              | Reload the saved event after creation, then use the update path.                                                                          |
| Account changes    | A page loaded anonymously could retain its denied/stale state after signing in without changing the URL.                                                             | Remount routed page data when the signed-in account changes.                                                                              |
| Overview           | Long event names used headline-number sizing; team labels were truncated to a few letters and an all-zero chart produced fractional axis labels.                     | Separate text and number sizing, allocate space for team names, and use a nonzero integer axis range.                                     |
| Team data          | Metadata and status labels were only 10–11px. Search/refresh controls lacked explicit names, and the refresh border retained the previous accent.                    | Raise small labels to 12px, name the controls, and use the shared border color.                                                           |
| Board format       | The existing 35-tile format was labeled "5×5".                                                                                                                       | Label it "35 tiles" in setup/review and overview. The stored value and existing events are unchanged. This does not add a 25-tile format. |
| Local previews     | Both Vite instances used one optimized-dependency cache, allowing a brand's optimization to invalidate the other's browser modules with `504 Outdated Optimize Dep`. | Give Little Town and Diamond Dogs separate cache directories. Verified the served import paths use separate caches.                       |

## Browser coverage

Visited every route below under both profiles at 1280×800 and 390×844. Also checked the longer Diamond Dogs header at 320px and the active board at laptop/desktop sizes during this redesign.

| Routes                             | Coverage                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                                | Landing, logo/profile content, navigation and login                                                    |
| `/BingoRules`                      | Original artwork and all six screenshots load; screenshot enlargement and close                        |
| `/BingoBoard`                      | Active 16-tile board, guest/unassigned states and sizing                                               |
| `/TeamData`                        | Unlinked state; populated mobile accordion checked with a temporary browser-only fixture, then removed |
| `/BingoScores`                     | XP ranking table and chart with the local teams                                                        |
| `/Resources`                       | Category navigation, search, results and RuneLite clipboard confirmation                               |
| `/recover`                         | Recovery form layout                                                                                   |
| `/invite/:token`                   | Invalid-token state                                                                                    |
| `/unauthorized`                    | Denied state and home navigation                                                                       |
| `/AdminPanel/BingoDetails`         | Existing event fields, step navigation, review and validation                                          |
| `/AdminPanel/BoardBuilder`         | Populated board, unclipped controls, edit dialog and cancellation                                      |
| `/AdminPanel/TeamDrafter`          | All tabs, player pool, populated teams, mouse-event movement, keyboard movement and cancellation       |
| `/AdminPanel/ScreenshotSubmission` | Empty review queue and refresh control                                                                 |
| `/AdminPanel/BingoOverview`        | Populated dashboard, team chart, dependency cards, player table and mobile layout                      |
| `/AdminPanel/Maintenance`          | Job descriptions and controls                                                                          |
| `/AdminPanel/UserInvite`           | Invite and recovery controls                                                                           |
| Unknown route                      | 404 state and home navigation                                                                          |

Compared the replaced homepage/navigation, rules, event setup, board builder and drafter against the original source. The original rules screenshots, event inputs, lifecycle controls, player-management tabs, drag/drop assignment logic, resource data and role filtering are retained.

No event edits, draft assignments, claims, maintenance jobs, invite acceptance, screenshot approval/denial or recovery emails were submitted during this audit. The populated team-data fixture existed only in the browser and was cleared by reloading. Screenshot approval with a populated queue, valid invite acceptance, email delivery and real-device touch dragging still need end-to-end acceptance with suitable fixtures.

## Checks

- Frontend suite: 29 files, 227 tests passed.
- Type checking passed.
- ESLint: no errors; 26 existing warnings.
- Little Town and Diamond Dogs production builds passed using explicit API URLs.
- Both local profiles remain available on ports 3000 and 3001, with the local API on 8081.
