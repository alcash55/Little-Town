# Team brief, Little-Town Sprint 18

Date: 2026-09-10. Tech lead: the coordinating session. Six role agents.

## Second interruption, 2026-09-10 at roughly 15:20 ET

The sprint was interrupted a second time. The session rate limit killed four
agents at once: accessibility, backend, frontend and qa-reviewer. The lead
committed and pushed every one of their working trees before relaunching, so
nothing was lost again.

State as of the relaunch:

| Branch | Checkpoint | Track |
| --- | --- | --- |
| `a11y-work` | `921c228` | accessibility, and it already carries the README revert the lead asked for as `6cbeee5` |
| `backend/54-55-56-61-side-accounts-cache-ci` | `f094996` | backend |
| `qa/49-coverage-gaps` | `4fd613e` | qa-reviewer |
| `frontend/46-48-perf-cleanup` | `43f433f` | frontend |

What already landed and must not be redone:

- https://github.com/alcash55/Little-Town/pull/74 is merged to `dev`, closing
  #51, #52 and #53. The security work is done. `dev` is now at `2d314a7`.
- https://github.com/alcash55/Little-Town/pull/75 is open for the docs track.
- https://github.com/alcash55/Little-Town/pull/77 is open for the data track.

**Rebase your branch on `origin/dev` before you write anything.** #53 moved the
auth token from `localStorage` to an httpOnly cookie and that reaches into
several tracks' files.

Two follow-ups were filed off this sprint and are already on the board. Do not
pull them into your branch: https://github.com/alcash55/Little-Town/issues/76
and https://github.com/alcash55/Little-Town/issues/78.

Commit and push after every meaningful step. Two interruptions in one day is
the actual working condition here, not bad luck.

## Read this first: you are resuming an interrupted sprint

A previous coordinating session hit its rate limit mid-sprint and four agents
died at once. Their work was not lost, but it was left uncommitted. The lead
has already recovered it into two checkpoint commits. Build on them. Do not
revert them and do not start those issues from scratch.

| Branch | Checkpoint | What it already contains |
| --- | --- | --- |
| `frontend/59-60-44-57-58-a11y-readme` | `78bc916` | The #59 aria-label fix on `Home.tsx`, plus a repo-wide Prettier trailing-comma sweep across 66 files |
| `backend/54-55-56-61-side-accounts-cache-ci` | `39dec6e` | Work in progress on #54, #55 and #56, including two new files, `backend/src/db/hiscoreCache.ts` and `backend/tests/unit/hiscoresCache.test.ts` |

Both checkpoints are pushed. Neither is reviewed and neither is split by
issue. Treat them as a starting position from a colleague who left mid-task:
read the diff, decide what is right, keep what is, fix what is not.

`ci/41-backend-ci-skip-gap` already merged to `dev` as PR #73, closing #41.
Do not redo it.

## Goal

Close the Sprint 18 backlog and the four queued hardening issues. Two of the
queued items are live security problems, not cleanup: #51 seeds fixture admin
credentials in a production migration, and #53 keeps the auth token in
`localStorage`. Those two set the sprint's priority order.

## Branch rules

- `dev` is at `609e60f` and is current with `main`. Branch from `dev`.
- Never branch from `main`. Never push to `main`. Never merge anything to
  `main` yourself.
- You own exactly one branch, named in your track below. Do not commit to
  another track's branch. If you need a change that lives in someone else's
  files, say so in your report and let `qa-reviewer` reconcile it.
- Open a PR against `dev` when your track is done. `qa-reviewer` verifies and
  merges. The lead opens the single `dev` to `main` PR at the end.
- Commit messages get the `unslop` pass. Never add a `Co-Authored-By` trailer
  or any other attribution line.

## Tracks

### qa-reviewer, branch `qa/49-coverage-gaps`

1. First, before anything else: verify PR #74 on branch
   `auth/51-52-53-cookie-and-fixture-hardening`, which closes #51, #52 and
   #53. One commit, 23 files. It is the security work, so it merges first and
   unblocks everyone else's rebase. Run the backend and frontend suites, lint
   and typecheck, then exercise login and an authenticated route in a real
   browser, because moving a token from `localStorage` to an httpOnly cookie
   breaks in ways a unit test does not see. Merge to `dev` if it holds. Report
   failures with reproduction steps if it does not.
2. Then #49, the test coverage gaps. Six items plus two that are more than
   test gaps: the dev CORS allowlist hardcoded to port 3000, and
   `normalizeRsnForMatch` duplicating `canonicalizeRsn` plus `normalizeRsn`.
   Widen the CORS allowlist to a bounded localhost port range in the
   non-production branch only. Never a blanket allow.
3. At the end, verify the merged result of every track on `dev` together, not
   branch by branch. Integration problems between tracks are the thing you
   exist to catch.

The iOS Safari real-device check in #49 needs hardware you do not have. Record
it as unverified with that reason. Do not claim a manual verification you did
not perform.

### backend, branch `backend/54-55-56-61-side-accounts-cache-ci`

Resume from checkpoint `39dec6e`. Own #54, #55, #56, #61 and #45.

- #54, team roster per-player deltas miss side accounts, so totals do not
  reconcile.
- #55, `snapshotAllSideAccounts` queries per player instead of using the
  existing batch helper.
- #56, the `hiscore_cache` table is wired in migrations and never read by app
  code. The checkpoint already started `hiscoreCache.ts`.
- #61, backend CI workflow has no concurrency group. One line.
- #45, six independent correctness fixes. Read the issue for all six.

On #45's `express-rate-limit` 7.5.1 to 8.x bump: Dependabot PR #63 already
proposes exactly that bump against `main`. Do the bump on your branch as the
issue asks, deliberately and with a test for IPv6 client keys specifically,
then say in your report that #63 is now redundant. A subtly wrong key function
weakens rate limiting silently rather than erroring, which is why this is not
a drive-by.

Run `why` before rewriting the rate limiters or the snapshot logic. Both have
the shape of code that encodes a past incident.

### data-engineer, branch `data/47-schema`

Own #47 only. The `hiscore_cache` app wiring belongs to `backend` on its
branch, so coordinate through the lead rather than editing their files.

- The `NOTIFY pgrst, 'reload schema';` for `rsn_claims` runs against Alex's
  production Supabase. You cannot run it. Write the exact one-line SQL and put
  it in your report as a step for Alex, and generate a `wizard` if it needs
  more than one action in the dashboard.
- The `bingo_player_hiscore_history` retention policy: the issue explicitly
  says do not guess a number now. Record the decision as "revisit after the
  next real event" with that written trigger, which satisfies the acceptance
  criterion. Do not invent a retention window.
- The `citext` or normalized index for `bingo_players UNIQUE(bingo_id, rsn)`:
  write and test the migration locally, then remove the application-level
  case-insensitive workaround only once the schema enforces it. Test primary
  and side-account coexistence specifically.

### accessibility, branch `frontend/59-60-44-57-58-a11y-readme`

Resume from checkpoint `78bc916`. Own #59, #60, #44 and the accessibility
section of #48.

- #59 is partly done in the checkpoint. Review it rather than trusting it. The
  bug is real and worth understanding: icon accessible names were sliced out
  of raw asset filenames, so a screen reader announced a slur-adjacent string
  to users. Check every remaining icon name is explicit and reviewed, not
  derived.
- #60, the sidebar toggle never exposes its open or closed state.
- #44, the 403 sweep, wiring remaining pages to `PageLayout`'s
  `permissionDenied` state.
- #48 accessibility items: the mobile drawer close button with no
  `aria-label`, `LoginModal`'s `validateDOMNesting` warning from an `<h6>`
  inside an `<h2>` (the same fix already landed on `OnboardingWizard`, follow
  it), the stale "Access Denied" flash after clearing impersonation, and the
  cross-tab redirect wording.

You also own the repo-wide `prettier --write .` pass from #48, because your
checkpoint already contains most of it. Finish it in a single commit that
contains nothing else, so every other diff in this sprint stays readable.

Target is WCAG 2.2 AA. Verify in a real browser, not by reading markup. Name
the routes and states you exercised in your report, or the check does not
count.

### frontend, branch `frontend/46-48-perf-cleanup`

Branch fresh from `dev`. Own #46 and the cleanup section of #48. Do not touch
the accessibility branch.

- #46, the 15MB `LittleTownAnimation.gif` on Home, the Vite 5.4.21 to 6.4.3+
  bump, adding ESLint to `frontend/`, and the completion engine caching
  question. That last one is explicitly a deferral: record the written trigger
  condition, do not build a cache.
- #48 cleanup items: the unconsumed `/api/bingo/team-data` endpoint, the stale
  `/my-team-data` doc comment, the `any` casts in `useBoardBuilder.ts`, the
  `SidebarItem` type missing its `roles` field, the stale `@mui/x-data-grid`
  comment in `vite.config.ts`, the literal `#2A9D8F` in `teamDrafterStyles.ts`
  that should be `appColors.accent`, the `calvarion` apostrophe mismatch in
  `bingoArtEntities.ts`, the noisy `ECONNRESET` stack in `imageLinks.test.ts`,
  `BingoBoard`'s `maxWidth: 900`, the duplicate-username error text from
  `accept_invite`, the `protect` and `optionalAuth` merge question, the Team
  Drafter self-claimed versus admin-entered distinction, and the login rate
  limit env override.

In TypeScript, type it properly. The `any` casts in this list are the reason
the item exists, so replacing one `any` with another fails the ticket. Use
`unknown` plus narrowing, a generic, or a real interface.

Every screen stays responsive down to 320px, and every state gets designed:
empty, loading, error, partial, overflowing.

### technical-writer, branch `docs/57-58-readme`

Branch fresh from `dev`. Own #57, #58 and the docs section of #48.

- #57, the root README Quick Start uses commands that do not exist.
- #58, the root README says the backend deploys to Supabase. It deploys to
  Render. Check `render.yaml` rather than trusting either the README or the
  ticket.
- #48 docs: the backend README does not document the bingo routes, including
  `/board`'s optional-auth behavior.

Read the diff, not the ticket. The ticket says what was intended and the diff
says what shipped. Note that the accessibility branch's checkpoint also
touched the root README, so check for a conflict and flag it rather than
silently overwriting.

Run `unslop` on every human-facing string. Also update the `Little-Town` note
in Alex's Obsidian vault at
`/mnt/c/Users/Alex/Documents/Obsidian Vault/Dev Projects/`, and append one
line to `_System/Changelog.md` dated 2026-09-10 ending with `(AI)`.

## Interface contracts between tracks

- `backend` owns everything under `backend/src/` except the CORS allowlist in
  `backend/src/index.ts`, which `qa-reviewer` owns for #49.
- `data-engineer` owns `backend/supabase/migrations/` and nothing else.
- `accessibility` owns the repo-wide Prettier pass. Nobody else runs
  `prettier --write .` across the repo. Format only the files you edited.
- `frontend` and `accessibility` both work in `frontend/src/components/`.
  Split by the file lists in your tracks above. If you need a file the other
  track owns, report it, do not take it.
- `technical-writer` owns `README.md` and `backend/README.md`.
- The auth branch merges to `dev` first. Everyone rebases on `dev` after that
  lands, because #53 changes how the frontend gets its token and that reaches
  into other tracks' files.

## Done criteria

A track is done when all of these are true.

- Every acceptance criterion on its issues is met, or the ones that are not
  are named in the report with the reason.
- Backend and frontend tests, lint and typecheck pass on the branch.
- Behavior that a test cannot prove was exercised in a real browser, with the
  routes and states named.
- A PR is open against `dev` with a body that explains the reasoning. The
  reasoning goes in the PR body, not in your report to the lead.
- Every issue the track closes is checked off and moved on the board.

The sprint is done when every track is merged to `dev`, `qa-reviewer` has
verified the merged result, one PR from `dev` to `main` is open for Alex, and
this file and any `SPRINT-STATUS.md` are deleted from the repo.

## Failure policy

Agents die. Say what happened rather than working around it silently.

- **Rate limit or a tool that stops responding.** Report partial completion
  visibly, naming exactly which issues landed and which did not, and leave
  your work on a pushed branch rather than in your session. The last
  interruption cost nothing precisely because the work was on pushed branches.
  Commit and push early and often for that reason.
- **A worktree sandbox wall.** Expected on this machine. Work around it and
  say which workaround you used. Do not abandon the track over it.
- **A blocked step that needs Alex.** Production Supabase, a provider
  dashboard, real iOS hardware, credentials. Generate a `wizard` or write the
  exact step in your report. Never fake the verification.
- **A test you cannot make pass.** Leave it failing, say so, and file an
  issue. Never delete or skip a test to make a suite green. #41 existed
  because 287 tests self-skipped while CI showed green.

Partial completion reported clearly beats a track that quietly shrank.

## Reporting

Report back as a table, not an essay: issue number, outcome, and one line.
Outcomes are landed, partial, blocked, or deferred. Put the reasoning in the
PR body where reviewers will actually read it.

Then add anything that is Alex's decision rather than yours, and anything you
found that is out of scope. New work found mid-sprint goes on the board as a
Todo tagged for the next sprint, that turn. Keep it out of this branch.

## Out of scope

Eleven Dependabot PRs (#63 to #72) are open against `main`. Leave them alone
except to note redundancy, as the `backend` and `frontend` tracks are told to
do for the `express-rate-limit` and Vite bumps.

## Voice

Alex's global rules at `~/.claude/CLAUDE.md` govern every string this sprint
produces: commit messages, PR bodies, issue text, code comments, UI copy,
vault notes, and your report to the lead. Run `unslop` on all of it. No em
dashes anywhere, and parentheses are not a substitute. Sentence case headings.
Straight quotes. Active voice, one idea per sentence. Comments explain why,
not what. Name a PR or issue with its full URL, never a bare number.
