import { activateBingo } from "../db/bingos.js";
import { getBingoPlayers, savePlayerSnapshot, clearStartSnapshot, BingoPlayer } from "../db/players.js";
import { mapWithConcurrency, HISCORE_CONCURRENCY } from "../lib/concurrency.js";
import { hiscores } from "./hiscores.js";
import { checkRsnChange, RsnChangeSource } from "./rsnChangeDetection.js";
import { snapshotAllSideAccounts, SideSnapshotResult } from "./sideAccountSnapshots.js";

// Re-exported for existing call sites (routes/admin.ts, playerSnapshotCron.ts)
// that import HISCORE_CONCURRENCY from here — the value itself now lives in
// lib/concurrency.ts so services/sideAccountSnapshots.ts can share it
// without a circular import back to this module.
export { HISCORE_CONCURRENCY };

export interface PlayerSnapshotResult {
  rsn: string;
  playerId: string;
  ok: boolean;
  error?: string;
}

/**
 * Takes start + current snapshots for an explicit list of players, capped at
 * HISCORE_CONCURRENCY in-flight hiscore lookups, and — as a separate capped
 * phase afterward — start + current snapshots for every one of those
 * players' side accounts too (see services/sideAccountSnapshots.ts; this is
 * what feeds GET /api/bingo/:bingoId/conflicts). Also runs RSN-change
 * detection (TEAM-BRIEF.md Track A item 1) on every MAIN-account lookup
 * made (side accounts aren't covered — see sideAccountSnapshots.ts).
 *
 * `savePlayerSnapshot(..., "start", ...)` only ever writes once per account
 * (see db/players.ts), so calling this again for the same players — e.g. the
 * retake-start-snapshots admin route retrying just the ones still missing a
 * start snapshot — is idempotent by default: accounts that already
 * succeeded are simply re-confirmed ("start" untouched, "current"
 * refreshed).
 *
 * `retakeExisting` (TEAM-BRIEF.md Sprint 14, D2 fix; default false) flips
 * that: when true, any EXISTING start snapshot is cleared first
 * (db/players.ts's clearStartSnapshot) so this call's fresh hiscore fetch
 * becomes the new baseline instead of being ignored. Set by bingo
 * activation ONLY (both manual and cron auto-activation, via
 * takeActivationSnapshots below) — activation time IS the baseline for the
 * bingo about to start, so a start snapshot taken earlier at registration
 * (which can predate activation by days) must be replaced, not preserved.
 * retake-start-snapshots (routes/admin.ts) must keep the default
 * (false) — it exists to fill in snapshots that failed during activation,
 * not to move an already-correct baseline.
 *
 * A failed side-account lookup never fails the parent player's own
 * main-account outcome — `failed`/`succeeded` only ever reflect main
 * accounts; side-account results are reported separately in `sideResults`.
 */
export async function snapshotStartAndCurrent(
  players: BingoPlayer[],
  source: RsnChangeSource,
  retakeExisting = false,
): Promise<{
  succeeded: number;
  failed: string[];
  results: PlayerSnapshotResult[];
  sideResults: SideSnapshotResult[];
}> {
  if (!players.length) return { succeeded: 0, failed: [], results: [], sideResults: [] };

  const settled = await mapWithConcurrency(players, HISCORE_CONCURRENCY, async (player) => {
    const data = await hiscores(player.rsn);
    // RSN-change detection + Sprint 6's WOM auto-rename (see
    // services/rsnChangeDetection.ts) — a confirmed rename updates
    // bingo_players.rsn and hands back hiscore data for the new name so
    // this activation/retake attempt can proceed under it immediately.
    const rsnCheck = await checkRsnChange(player, Boolean(data), source);
    const effectiveData = data ?? rsnCheck.hiscoreData ?? null;
    if (!effectiveData) {
      throw new Error(
        `Player "${player.rsn}" is not ranked on the OSRS hiscores — ensure the RSN is correct and the account has played enough to appear on the hiscores`,
      );
    }
    // start is insert-if-absent by default; retakeExisting (activation
    // only) clears any pre-existing start row first so it's replaced.
    if (retakeExisting) await clearStartSnapshot(player.id);
    await savePlayerSnapshot(player.id, "start", effectiveData);
    await savePlayerSnapshot(player.id, "current", effectiveData);
    return rsnCheck.renamed ? rsnCheck.newRsn! : player.rsn;
  });

  const results = toPlayerSnapshotResults(players, settled);
  const failed = results.filter((r) => !r.ok).map((r) => r.error!);
  const succeeded = results.filter((r) => r.ok).length;

  // Separate phase, strictly after the main-account pass above — keeps peak
  // in-flight OSRS requests capped at HISCORE_CONCURRENCY at any instant
  // rather than adding a second concurrent pool on top. Side accounts get
  // the same retakeExisting treatment as their parent — they feed the same
  // team-total math (services/completionEngine.ts), so an activation must
  // rebaseline them too, not just the primary account.
  const sideResults = await snapshotAllSideAccounts(players, ["start", "current"], source, retakeExisting);

  return { succeeded, failed, results, sideResults };
}

/** Takes start + current snapshots for every player currently in a bingo (and their side accounts). */
export async function takeActivationSnapshots(
  bingoId: string,
  source: RsnChangeSource = "drafter",
): Promise<{
  succeeded: number;
  failed: string[];
  results: PlayerSnapshotResult[];
  sideResults: SideSnapshotResult[];
}> {
  const players = await getBingoPlayers(bingoId);
  // retakeExisting: true — see snapshotStartAndCurrent's doc comment.
  // Activation is the only call site that should ever move an existing
  // start baseline.
  return snapshotStartAndCurrent(players, source, true);
}

function toPlayerSnapshotResults(
  players: BingoPlayer[],
  settled: PromiseSettledResult<string>[],
): PlayerSnapshotResult[] {
  return players.map((player, i) => {
    const r = settled[i];
    // r.value is the (possibly WOM-auto-renamed) rsn the snapshot actually
    // succeeded under — prefer it over the stale players[] entry so callers
    // reporting results see the current name, not the one that just 404'd.
    if (r.status === "fulfilled") return { rsn: r.value, playerId: player.id, ok: true };
    return {
      rsn: player.rsn,
      playerId: player.id,
      ok: false,
      error: (r as PromiseRejectedResult).reason?.message ?? "Unknown error",
    };
  });
}

export interface ActivationOutcome {
  /** True once the bingo actually flipped draft -> active on this call. */
  activated: boolean;
  /**
   * True when activation was withheld because one or more players' start
   * snapshots failed and `force` was not set (TEAM-BRIEF.md Track A item 2).
   * Snapshots taken during a blocked attempt are harmless — successful ones
   * are real "start" rows a subsequent activation (forced or retried) will
   * reuse via savePlayerSnapshot's idempotent upsert.
   */
  blocked: boolean;
  succeeded: number;
  failed: string[];
  results: PlayerSnapshotResult[];
  /**
   * Side-account snapshot outcomes (best-effort, never blocks activation —
   * only main-account `failed` above affects `blocked`).
   */
  sideResults: SideSnapshotResult[];
}

/**
 * Takes activation snapshots for a bingo, then atomically flips it from
 * draft -> active via the activate_bingo RPC — unless one or more players'
 * start snapshots failed and `force` isn't set, in which case activation is
 * withheld (`blocked: true`) so an admin can fix RSNs or explicitly force
 * through. Shared by the manual "Start now" admin route (force: caller's
 * choice) and the snapshot cron's auto-activation of due drafts (force:
 * true — unattended, so it always proceeds and relies on loud logging +
 * POST /bingo/:bingoId/retake-start-snapshots for cleanup).
 *
 * `activated` is also false if this call lost the race (bingo was already
 * active or not a draft) — check `blocked` to tell the two cases apart.
 */
export async function activateBingoWithSnapshots(
  bingoId: string,
  options: { force?: boolean; source?: RsnChangeSource } = {},
): Promise<ActivationOutcome> {
  const { force = false, source = "drafter" } = options;
  const { succeeded, failed, results, sideResults } = await takeActivationSnapshots(bingoId, source);

  if (failed.length > 0 && !force) {
    return { activated: false, blocked: true, succeeded, failed, results, sideResults };
  }

  const activated = await activateBingo(bingoId);
  return { activated, blocked: false, succeeded, failed, results, sideResults };
}
