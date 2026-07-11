import { activateBingo } from "../db/bingos.js";
import { getBingoPlayers, savePlayerSnapshot, BingoPlayer } from "../db/players.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { hiscores } from "./hiscores.js";
import { checkRsnChange, RsnChangeSource } from "./rsnChangeDetection.js";

// Cap concurrent OSRS hiscore lookups across all fan-out call sites
// (activation, refresh-all, the snapshot cron).
export const HISCORE_CONCURRENCY = 5;

export interface PlayerSnapshotResult {
  rsn: string;
  playerId: string;
  ok: boolean;
  error?: string;
}

/**
 * Takes start + current snapshots for an explicit list of players, capped at
 * HISCORE_CONCURRENCY in-flight hiscore lookups. Also runs RSN-change
 * detection (TEAM-BRIEF.md Track A item 1) on every lookup made.
 *
 * `savePlayerSnapshot(..., "start", ...)` only ever writes once per player
 * (see db/players.ts), so calling this again for the same players — e.g. the
 * retake-start-snapshots admin route retrying just the ones still missing a
 * start snapshot — is idempotent: players who already succeeded are simply
 * re-confirmed (their "start" row is untouched, "current" is refreshed).
 */
export async function snapshotStartAndCurrent(
  players: BingoPlayer[],
  source: RsnChangeSource,
): Promise<{ succeeded: number; failed: string[]; results: PlayerSnapshotResult[] }> {
  if (!players.length) return { succeeded: 0, failed: [], results: [] };

  const settled = await mapWithConcurrency(players, HISCORE_CONCURRENCY, async (player) => {
    const data = await hiscores(player.rsn);
    await checkRsnChange(player, Boolean(data), source);
    if (!data) {
      throw new Error(
        `Player "${player.rsn}" is not ranked on the OSRS hiscores — ensure the RSN is correct and the account has played enough to appear on the hiscores`,
      );
    }
    // start is idempotent — won't overwrite if already exists
    await savePlayerSnapshot(player.id, "start", data);
    await savePlayerSnapshot(player.id, "current", data);
    return player.rsn;
  });

  const results = toPlayerSnapshotResults(players, settled);
  const failed = results.filter((r) => !r.ok).map((r) => r.error!);
  const succeeded = results.filter((r) => r.ok).length;

  return { succeeded, failed, results };
}

/** Takes start + current snapshots for every player currently in a bingo. */
export async function takeActivationSnapshots(
  bingoId: string,
  source: RsnChangeSource = "drafter",
): Promise<{ succeeded: number; failed: string[]; results: PlayerSnapshotResult[] }> {
  const players = await getBingoPlayers(bingoId);
  return snapshotStartAndCurrent(players, source);
}

function toPlayerSnapshotResults(
  players: BingoPlayer[],
  settled: PromiseSettledResult<string>[],
): PlayerSnapshotResult[] {
  return players.map((player, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") return { rsn: player.rsn, playerId: player.id, ok: true };
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
  const { succeeded, failed, results } = await takeActivationSnapshots(bingoId, source);

  if (failed.length > 0 && !force) {
    return { activated: false, blocked: true, succeeded, failed, results };
  }

  const activated = await activateBingo(bingoId);
  return { activated, blocked: false, succeeded, failed, results };
}
