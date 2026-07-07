import { getActiveBingo, getDueDraftBingos } from "../db/bingos.js";
import { getBingoPlayers, savePlayerSnapshot } from "../db/players.js";
import { activateBingoWithSnapshots, HISCORE_CONCURRENCY } from "./bingoActivation.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { hiscores } from "./hiscores.js";

const INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

let cronTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

/**
 * Fetches the latest hiscores for every player in the active bingo
 * and saves them as 'current' snapshots. Called by the cron and by
 * the manual "Refresh Stats" button via the admin API.
 */
export async function refreshAllPlayerSnapshots(): Promise<{
  succeeded: number;
  failed: string[];
}> {
  const bingo = await getActiveBingo();
  if (!bingo?.id || bingo.status !== "active") {
    return { succeeded: 0, failed: [] };
  }

  const players = await getBingoPlayers(bingo.id);
  if (!players.length) return { succeeded: 0, failed: [] };

  const results = await mapWithConcurrency(players, HISCORE_CONCURRENCY, async (player) => {
    const data = await hiscores(player.rsn);
    if (!data) {
      console.warn(`[playerSnapshotCron] Skipping "${player.rsn}" — not on hiscores (unranked).`);
      throw new Error(`Player "${player.rsn}" is not ranked on the OSRS hiscores`);
    }
    await savePlayerSnapshot(player.id, "current", data);
    return player.rsn;
  });

  const failed = results
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message ?? "Unknown error");

  const succeeded = results.filter((r) => r.status === "fulfilled").length;

  console.log(
    `[playerSnapshotCron] Refreshed ${succeeded} player(s)${failed.length ? `; ${failed.length} failed` : ""}.`,
  );

  return { succeeded, failed };
}

/**
 * Auto-activates any draft bingo whose scheduled start_date has passed,
 * using the same snapshot-then-activate logic as the manual admin route.
 */
async function autoActivateDueBingos(): Promise<void> {
  // Only one bingo can be active at a time (uq_bingos_one_active) — if one
  // already is, there's nothing to activate and no point snapshot-fanning-out.
  const activeBingo = await getActiveBingo();
  if (activeBingo?.status === "active") return;

  const dueBingos = await getDueDraftBingos();
  for (const bingo of dueBingos) {
    if (!bingo.id) continue;
    try {
      const { activated, succeeded, failed } = await activateBingoWithSnapshots(bingo.id);
      if (activated) {
        console.log(
          `[playerSnapshotCron] Auto-activated bingo "${bingo.name}" (${succeeded} snapshot(s) saved${
            failed.length ? `, ${failed.length} failed` : ""
          }).`,
        );
        // Only one bingo can be active — stop after the first success.
        break;
      }
    } catch (e) {
      console.error(`[playerSnapshotCron] Failed to auto-activate bingo "${bingo.name}":`, e);
    }
  }
}

async function tick(): Promise<void> {
  try {
    await autoActivateDueBingos();
    await refreshAllPlayerSnapshots();
  } catch (e) {
    console.error("[playerSnapshotCron] Tick error:", e);
  }
  // A stop() call during this in-flight tick must not resurrect the timer.
  if (stopped) return;
  cronTimer = setTimeout(tick, INTERVAL_MS);
}

export function startPlayerSnapshotCron(): void {
  console.log("[playerSnapshotCron] Starting (interval: 20 min)...");
  stopped = false;
  tick();
}

export function stopPlayerSnapshotCron(): void {
  stopped = true;
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
    console.log("[playerSnapshotCron] Stopped.");
  }
}
