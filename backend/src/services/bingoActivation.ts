import { activateBingo } from "../db/bingos.js";
import { getBingoPlayers, savePlayerSnapshot } from "../db/players.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { hiscores } from "./hiscores.js";

// Cap concurrent OSRS hiscore lookups across all fan-out call sites
// (activation, refresh-all, the snapshot cron).
export const HISCORE_CONCURRENCY = 5;

/**
 * Takes start + current snapshots for every player in a bingo, capped at
 * HISCORE_CONCURRENCY in-flight hiscore lookups.
 */
export async function takeActivationSnapshots(
  bingoId: string,
): Promise<{ succeeded: number; failed: string[] }> {
  const players = await getBingoPlayers(bingoId);
  if (!players.length) return { succeeded: 0, failed: [] };

  const results = await mapWithConcurrency(players, HISCORE_CONCURRENCY, async (player) => {
    const data = await hiscores(player.rsn);
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

  const failed = results
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message ?? "Unknown error");
  const succeeded = results.filter((r) => r.status === "fulfilled").length;

  return { succeeded, failed };
}

/**
 * Takes activation snapshots for a bingo, then atomically flips it from
 * draft -> active via the activate_bingo RPC. Shared by the manual
 * "Start now" admin route and the snapshot cron's auto-activation of due
 * drafts, so both take snapshots the same way and activate atomically.
 *
 * `activated` is false if this call lost the race (bingo was already active
 * or not a draft) — the snapshots taken are harmless no-ops in that case.
 */
export async function activateBingoWithSnapshots(
  bingoId: string,
): Promise<{ activated: boolean; succeeded: number; failed: string[] }> {
  const { succeeded, failed } = await takeActivationSnapshots(bingoId);
  const activated = await activateBingo(bingoId);
  return { activated, succeeded, failed };
}
