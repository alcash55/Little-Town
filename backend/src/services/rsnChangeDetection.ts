import {
  logRsnChange,
  logSideAccountRsnChange,
  resolveRsnChange,
  resolveSideAccountRsnChange,
  resolveRsnChangeAutoRename,
  RsnChangeSource,
} from "../db/rsnChangeLog.js";
import { updatePlayerRsn, updateSideAccountRsn } from "../db/players.js";
import { hiscores } from "./hiscores.js";
import { HiscoreData } from "../types/index.js";

export type { RsnChangeSource } from "../db/rsnChangeLog.js";

// -------------------------------------------------------
// Automatic RSN-rename resolution (Sprint 6 follow-up to Track A item 1).
//
// Previously, checkRsnChange only ever logged/cleared rsn_change_log rows —
// it never touched bingo_players.rsn, so a real in-game rename permanently
// stalled a player's stats until an admin fixed it by hand. Now, whenever a
// registered player's (or side account's) hiscore lookup 404s, we ask Wise
// Old Man whether that RSN has an APPROVED rename on file, verify the
// candidate new name actually resolves on the OSRS hiscores, and if so:
//   - update bingo_players.rsn (or bingo_player_side_accounts.rsn)
//   - mark the rsn_change_log row resolved with new_rsn + resolution:
//     'auto_wom'
//   - hand the caller the hiscore data already fetched for the new name, so
//     the CURRENT tick's snapshot can proceed immediately under the new
//     name instead of waiting for the next one.
//
// If WOM has nothing, or the candidate name doesn't resolve either (covers
// bans / unranked accounts, which WOM has no special signal for), behavior
// is unchanged from before: log/keep the unresolved row, caller skips the
// player this tick.
// -------------------------------------------------------

const WOM_API_BASE = "https://api.wiseoldman.net/v2";
// WOM asks integrations to identify themselves; no auth required at our
// volume (a handful of lookups per stale RSN per hour, see the throttle
// below).
const WOM_USER_AGENT = "LittleTown-Bingo (github.com/alcash55/Little-Town)";
const WOM_REQUEST_TIMEOUT_MS = 10_000;
// A rename chain (A -> B -> C -> ...) shouldn't realistically go deeper than
// a couple of hops; this is just a hard stop against an unexpected WOM
// response (e.g. a genuine A<->B swap-back loop) spinning forever.
const MAX_RENAME_HOPS = 5;
const WOM_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Last WOM lookup attempt per subject (player_id or side_account_id),
 * process-local only — not persisted to the DB. Tradeoff: on a multi-instance
 * deploy, or right after a restart, each process re-throttles independently,
 * so the *actual* worst-case WOM call rate for one persistently-stale RSN is
 * a little higher than "once per hour". That's fine here: the cost being
 * guarded against is wasted WOM calls, not correctness — the unresolved
 * rsn_change_log row (a real DB row) remains the single source of truth for
 * "is this RSN still stale", and every hiscore-lookup call site already
 * tolerates a stale RSN being skipped for another tick. A DB column would
 * remove the tradeoff but costs a write on every throttled check just to
 * record "still nothing to report" — not worth it at this app's scale.
 */
const lastWomAttemptAt = new Map<string, number>();

function shouldAttemptWom(subjectKey: string): boolean {
  const last = lastWomAttemptAt.get(subjectKey);
  return last === undefined || Date.now() - last >= WOM_THROTTLE_MS;
}

interface WomNameChange {
  oldName: string;
  newName: string;
  status: string; // "pending" | "denied" | "approved" (WOM's NameChangeStatus)
  resolvedAt: string | null;
  createdAt: string;
}

/**
 * GET /v2/names?username=<rsn> — every name change WOM knows about that
 * involves `username`. A username WOM has never seen 404s; treated as "no
 * data" rather than an error so a brand-new/never-tracked player doesn't
 * spam error logs on every stale tick.
 */
async function fetchWomNameChanges(username: string): Promise<WomNameChange[]> {
  const url = `${WOM_API_BASE}/names?username=${encodeURIComponent(username)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": WOM_USER_AGENT },
    signal: AbortSignal.timeout(WOM_REQUEST_TIMEOUT_MS),
  });

  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`WOM /names lookup for "${username}" failed: HTTP ${response.status}`);
  }

  const body: unknown = await response.json();
  return Array.isArray(body) ? (body as WomNameChange[]) : [];
}

/**
 * Walks WOM's approved name-change history starting from `startRsn`,
 * re-querying /names for each new name reached, following chains (A -> B,
 * then B -> C, ...) up to MAX_RENAME_HOPS deep. Returns the final name
 * reached if at least one approved hop was found, else null (no WOM data,
 * or nothing APPROVED matching the starting name).
 *
 * At each hop, only APPROVED changes whose oldName matches the current name
 * (case-insensitively) AND whose resolvedAt/createdAt is strictly after the
 * PREVIOUS hop's are eligible; among those, the most recent one is taken.
 * The "strictly after the previous hop" half of that rule (not just the
 * case-insensitive `seen` set below) is what makes this cycle-proof against
 * a real shape WOM data can take: an OSRS name can be freed and reused by a
 * different account later, so /names?username=X can return more than one
 * APPROVED "oldName: X" record from entirely different points in time. A
 * prod player this shipped for did exactly that — "Catgirl Ally" ->
 * "Tzhaar Chud" (an older, unrelated hop from before "Tzhaar Chud" was
 * freed and picked up by the account we're actually tracking), then much
 * later "Tzhaar Chud" -> "CatgirlAlly" -> "DogGirlAlly" (the real chain). A
 * naive "just don't revisit an exact string" guard doesn't protect against
 * that shape at all (none of those strings repeat) — the monotonic
 * timestamp requirement does, and also caps the walk without relying purely
 * on MAX_RENAME_HOPS.
 */
async function resolveWomChainedRename(startRsn: string): Promise<string | null> {
  let current = startRsn;
  const seen = new Set([current.toLowerCase()]);
  let after = -Infinity;
  let hops = 0;

  for (let i = 0; i < MAX_RENAME_HOPS; i++) {
    const changes = await fetchWomNameChanges(current);
    const candidates = changes
      .filter(
        (c) =>
          typeof c.status === "string" &&
          c.status.toLowerCase() === "approved" &&
          typeof c.oldName === "string" &&
          c.oldName.toLowerCase() === current.toLowerCase(),
      )
      .map((c) => ({ change: c, at: new Date(c.resolvedAt ?? c.createdAt).getTime() }))
      .filter((c) => Number.isFinite(c.at) && c.at > after)
      .sort((a, b) => b.at - a.at); // most recent (but still > `after`) first

    if (!candidates.length) break;

    const { change, at } = candidates[0];
    const next = change.newName;
    if (!next || seen.has(next.toLowerCase())) break; // belt-and-suspenders
    current = next;
    seen.add(current.toLowerCase());
    after = at;
    hops++;
  }

  return hops > 0 ? current : null;
}

interface ResolvedRename {
  newRsn: string;
  hiscoreData: HiscoreData;
}

/**
 * Looks up an approved rename chain on Wise Old Man for `oldRsn` and, if
 * found, verifies the resulting name actually resolves on the OSRS
 * hiscores before trusting it — WOM records a rename as APPROVED
 * independently of whether the resulting account is still ranked (or even
 * exists post-ban), so this is the step that rules out bans/unranked
 * accounts per the design doc. Returns null on any of: no WOM data, no
 * approved change, or the candidate name not resolving.
 */
async function tryResolveRenameViaWom(oldRsn: string): Promise<ResolvedRename | null> {
  const finalName = await resolveWomChainedRename(oldRsn);
  if (!finalName) return null;

  const hiscoreData = await hiscores(finalName);
  if (!hiscoreData) return null;

  return { newRsn: finalName, hiscoreData };
}

export interface CheckRsnChangeResult {
  /** True when this call confirmed and applied a WOM rename. */
  renamed: boolean;
  /** The new RSN now on file — only set when `renamed` is true. */
  newRsn?: string;
  /**
   * Hiscore data already fetched for `newRsn` while confirming the rename —
   * callers should save this as the current tick's snapshot instead of
   * re-fetching, so stats resume immediately rather than on the next tick.
   * Only set when `renamed` is true.
   */
  hiscoreData?: HiscoreData;
}

interface RsnChangeSubject {
  kind: "player" | "side_account";
  id: string;
  rsn: string;
}

async function checkRsnChangeForSubject(
  subject: RsnChangeSubject,
  hiscoreFound: boolean,
  source: RsnChangeSource,
): Promise<CheckRsnChangeResult> {
  const label = subject.kind === "player" ? "player" : "side account";

  try {
    if (hiscoreFound) {
      if (subject.kind === "player") await resolveRsnChange(subject.id);
      else await resolveSideAccountRsnChange(subject.id);
      // A subject that's resolving again deserves a fresh WOM check the
      // next time (if ever) it goes stale, rather than inheriting whatever
      // throttle window was in progress from an earlier stale episode.
      lastWomAttemptAt.delete(subject.id);
      return { renamed: false };
    }

    // Log (or reuse the existing unresolved) row first — this is the audit
    // trail and the thing rsnStale/rsnStaleSince key off, regardless of
    // whether WOM ends up resolving it later in this same call.
    const row =
      subject.kind === "player"
        ? await logRsnChange(subject.id, subject.rsn, source)
        : await logSideAccountRsnChange(subject.id, subject.rsn, source);

    let renameResult: ResolvedRename | null = null;
    if (shouldAttemptWom(subject.id)) {
      lastWomAttemptAt.set(subject.id, Date.now());
      try {
        renameResult = await tryResolveRenameViaWom(subject.rsn);
      } catch (e) {
        console.error(`[rsnChangeDetection] Wise Old Man lookup failed for "${subject.rsn}":`, e);
      }
    }

    if (renameResult) {
      try {
        if (subject.kind === "player") await updatePlayerRsn(subject.id, renameResult.newRsn);
        else await updateSideAccountRsn(subject.id, renameResult.newRsn);
        await resolveRsnChangeAutoRename(row.id, renameResult.newRsn);

        // Loud on purpose (console.warn, not .log) — this is exactly the
        // kind of automatic change an admin should be able to spot in cron
        // output without having to go dig through rsn_change_log.
        console.warn(
          `[rsnChangeDetection] Auto-resolved RSN rename: "${subject.rsn}" -> "${renameResult.newRsn}" ` +
            `(${label} ${subject.id}, source: ${source}, via Wise Old Man).`,
        );

        return { renamed: true, newRsn: renameResult.newRsn, hiscoreData: renameResult.hiscoreData };
      } catch (e) {
        // e.g. the new name collides with another already-registered
        // player/side account (23505) — fall through to the unresolved
        // path below rather than losing the detection entirely.
        console.error(
          `[rsnChangeDetection] Found a Wise Old Man rename for "${subject.rsn}" -> "${renameResult.newRsn}" ` +
            `but failed to apply it:`,
          e,
        );
      }
    }

    // No result: keep the pre-existing behavior — unresolved flag row,
    // caller skips the subject. Also covers bans/unranked accounts (no
    // approved WOM rename exists for those either).
    console.warn(
      `[rsnChangeDetection] "${subject.rsn}" (${label} ${subject.id}) is no longer resolving on the OSRS ` +
        `hiscores and no confirmed Wise Old Man rename was found — logged as a possible RSN change ` +
        `(source: ${source}).`,
    );
    return { renamed: false };
  } catch (e) {
    console.error(`[rsnChangeDetection] Failed to record RSN status for "${subject.rsn}":`, e);
    return { renamed: false };
  }
}

/**
 * Detects an RSN going stale (an already-registered player whose on-file RSN
 * stops resolving on the OSRS hiscores), attempts to auto-resolve it via a
 * confirmed Wise Old Man rename, and logs/clears rsn_change_log either way.
 *
 * Call this everywhere the backend does a hiscore lookup for a player who is
 * already registered: the snapshot cron, activation/retake snapshots, and
 * the admin-panel single/bulk refresh routes the team drafter uses. Do NOT
 * call it from the initial registration lookup in POST /bingo/players — an
 * RSN that fails to resolve there isn't a "change", it just hasn't been
 * validated yet.
 *
 * Best-effort: any failure (WOM, hiscores re-check, or a DB write) is
 * swallowed (after a console.error) so it can never break the
 * snapshot/activation flow that triggered it — callers always get back a
 * `{ renamed: false }` in that case, same as "no WOM match".
 */
export async function checkRsnChange(
  player: { id: string; rsn: string },
  hiscoreFound: boolean,
  source: RsnChangeSource,
): Promise<CheckRsnChangeResult> {
  return checkRsnChangeForSubject({ kind: "player", id: player.id, rsn: player.rsn }, hiscoreFound, source);
}

/** Side-account counterpart of checkRsnChange — see services/sideAccountSnapshots.ts. */
export async function checkSideAccountRsnChange(
  sideAccount: { id: string; rsn: string },
  hiscoreFound: boolean,
  source: RsnChangeSource,
): Promise<CheckRsnChangeResult> {
  return checkRsnChangeForSubject(
    { kind: "side_account", id: sideAccount.id, rsn: sideAccount.rsn },
    hiscoreFound,
    source,
  );
}

/** Test-only: clears the in-memory WOM throttle map so each test starts fresh. */
export function _resetRsnChangeWomThrottleForTests(): void {
  lastWomAttemptAt.clear();
}
