import { getActiveBingo } from "../db/bingos.js";
import { getBingoPlayers, savePlayerSnapshot } from "../db/players.js";
import { hiscores } from "./hiscores.js";

const INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

let cronTimer: ReturnType<typeof setTimeout> | null = null;

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

  const results = await Promise.allSettled(
    players.map(async (player) => {
      const data = await hiscores(player.rsn);
      if (!data) {
        console.warn(`[playerSnapshotCron] Skipping "${player.rsn}" — not on hiscores (unranked).`);
        throw new Error(`Player "${player.rsn}" is not ranked on the OSRS hiscores`);
      }
      await savePlayerSnapshot(player.id, "current", data);
      return player.rsn;
    }),
  );

  const failed = results
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message ?? "Unknown error");

  const succeeded = results.filter((r) => r.status === "fulfilled").length;

  console.log(
    `[playerSnapshotCron] Refreshed ${succeeded} player(s)${failed.length ? `; ${failed.length} failed` : ""}.`,
  );

  return { succeeded, failed };
}

async function tick(): Promise<void> {
  try {
    await refreshAllPlayerSnapshots();
  } catch (e) {
    console.error("[playerSnapshotCron] Tick error:", e);
  }
  cronTimer = setTimeout(tick, INTERVAL_MS);
}

export function startPlayerSnapshotCron(): void {
  console.log("[playerSnapshotCron] Starting (interval: 20 min)...");
  tick();
}

export function stopPlayerSnapshotCron(): void {
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
    console.log("[playerSnapshotCron] Stopped.");
  }
}
