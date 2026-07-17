import { getActiveBingo, getDueDraftBingos } from "../db/bingos.js";
import { getBingoPlayers, savePlayerSnapshot } from "../db/players.js";
import { activateBingoWithSnapshots, HISCORE_CONCURRENCY } from "./bingoActivation.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { hiscores } from "./hiscores.js";
import { checkRsnChange } from "./rsnChangeDetection.js";
import { snapshotAllSideAccounts } from "./sideAccountSnapshots.js";
import { completeEndedBingos } from "./bingoLifecycle.js";

const INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

let cronTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

/**
 * True once a bingo's end_date has passed. Pure/exported so it's directly
 * unit-testable without a DB round trip.
 *
 * D3 fix (TEAM-BRIEF.md Sprint 14): bingo.status stays 'active' past
 * end_date until an admin (or a future dedicated cron) explicitly closes it
 * out — nothing today flips it automatically — so status alone can't gate
 * "is this bingo's scoring window still open". `endDate` is a date/
 * timestamp string compared lexically against `now.toISOString()`, the same
 * comparison style db/bingos.ts's getDueDraftBingos already uses for
 * start_date.
 */
export function isBingoPastEnd(endDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!endDate) return false;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() < now.getTime();
}

/**
 * Fetches the latest hiscores for every player in the active bingo (and, as
 * a separate capped phase, every one of their side accounts) and saves them
 * as 'current' snapshots. Called by the cron and by the manual "Refresh
 * Stats" button via the admin API.
 *
 * D3 fix (TEAM-BRIEF.md Sprint 14): skips entirely (no 'current' writes at
 * all, main or side) once the active bingo's end_date has passed — freezing
 * 'current' at whatever it was on end_date instead of letting it keep
 * drifting forever (prod history showed 20-minute ticks still running 17
 * days after end_date, so gains earned AFTER the bingo ended kept completing
 * tiles). Completion math (services/completionEngine.ts) must reflect gains
 * within the bingo's actual window, not whatever happened afterward while
 * status hadn't been flipped off 'active' yet. Retroactive repair of
 * 'current' rows already polluted by post-end-date ticks is impossible — no
 * per-metric history exists to reconstruct "gains as of end_date" after the
 * fact — and is explicitly out of scope for this fix.
 *
 * Side accounts only ever get a 'current' refresh here, never 'start' —
 * same as main accounts, whose 'start' snapshot is only ever taken once, at
 * registration or activation (see services/sideAccountSnapshots.ts and
 * services/bingoActivation.ts). A side account added after activation with
 * no 'start' snapshot yet won't get one from the cron; it needs a manual
 * retake (POST /bingo/:bingoId/retake-start-snapshots) or a future
 * dedicated action — known limitation, not in this pass's scope.
 */
export async function refreshAllPlayerSnapshots(): Promise<{
  succeeded: number;
  failed: string[];
}> {
  const bingo = await getActiveBingo();
  if (!bingo?.id || bingo.status !== "active") {
    return { succeeded: 0, failed: [] };
  }

  if (isBingoPastEnd(bingo.endDate)) {
    console.log(
      `[playerSnapshotCron] Skipping snapshot refresh — bingo "${bingo.name}" ended ${bingo.endDate}; ` +
        "'current' snapshots stay frozen at their end-of-bingo values.",
    );
    return { succeeded: 0, failed: [] };
  }

  const players = await getBingoPlayers(bingo.id);
  if (!players.length) return { succeeded: 0, failed: [] };

  const results = await mapWithConcurrency(players, HISCORE_CONCURRENCY, async (player) => {
    const data = await hiscores(player.rsn);
    // RSN-change detection (TEAM-BRIEF.md Track A item 1 + Sprint 6's WOM
    // auto-rename) — logs loudly and records rsn_change_log when a
    // previously-resolving RSN 404s. If Wise Old Man confirms an approved
    // rename that resolves on the hiscores, bingo_players.rsn is updated and
    // the returned hiscoreData lets this tick's snapshot proceed under the
    // new name immediately, instead of waiting for the next tick.
    const rsnCheck = await checkRsnChange(player, Boolean(data), "cron");
    const effectiveData = data ?? rsnCheck.hiscoreData ?? null;
    if (!effectiveData) {
      console.warn(`[playerSnapshotCron] Skipping "${player.rsn}" — not on hiscores (unranked).`);
      throw new Error(`Player "${player.rsn}" is not ranked on the OSRS hiscores`);
    }
    await savePlayerSnapshot(player.id, "current", effectiveData);
    return rsnCheck.renamed ? rsnCheck.newRsn! : player.rsn;
  });

  const failed = results
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message ?? "Unknown error");

  const succeeded = results.filter((r) => r.status === "fulfilled").length;

  // Separate phase, strictly after the main-account pass above (see
  // sideAccountSnapshots.ts for why this keeps peak in-flight OSRS requests
  // capped at HISCORE_CONCURRENCY rather than doubling it). A failed side
  // lookup never affects `succeeded`/`failed` above.
  const sideResults = await snapshotAllSideAccounts(players, ["current"], "cron");
  const sideFailed = sideResults.filter((r) => !r.ok);

  console.log(
    `[playerSnapshotCron] Refreshed ${succeeded} player(s)${failed.length ? `; ${failed.length} failed` : ""}` +
      `${sideResults.length ? `; ${sideResults.length - sideFailed.length}/${sideResults.length} side account(s) refreshed` : ""}.`,
  );
  if (sideFailed.length) {
    console.warn(
      `[playerSnapshotCron] ${sideFailed.length} side-account snapshot(s) failed: ` +
        sideFailed.map((r) => `"${r.rsn}"`).join(", "),
    );
  }

  return { succeeded, failed };
}

/**
 * Auto-activates any draft bingo whose scheduled start_date has passed,
 * using the same snapshot-then-activate logic as the manual admin route.
 *
 * Unlike the manual "Start now" route, this always forces activation through
 * even if some players' start snapshots failed — there's no admin present to
 * decide, and leaving a due bingo stuck in draft forever is worse than a few
 * missing snapshots. Failures are logged loudly; an admin can fix them later
 * via POST /api/admin/bingo/:bingoId/retake-start-snapshots.
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
      const { activated, succeeded, failed } = await activateBingoWithSnapshots(bingo.id, {
        force: true,
        source: "cron",
      });
      if (activated) {
        console.log(
          `[playerSnapshotCron] Auto-activated bingo "${bingo.name}" (${succeeded} snapshot(s) saved${
            failed.length ? `, ${failed.length} failed` : ""
          }).`,
        );
        if (failed.length) {
          console.warn(
            `[playerSnapshotCron] Auto-activation of "${bingo.name}" had ${failed.length} failed start ` +
              `snapshot(s) — retake via POST /api/admin/bingo/${bingo.id}/retake-start-snapshots: ${failed.join("; ")}`,
          );
        }
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
    // Lifecycle check runs FIRST (TEAM-BRIEF.md Sprint 15, Track A item 1):
    // flips any active bingo whose end_date has passed to 'complete' before
    // this tick tries to activate a due draft (freeing up
    // `uq_bingos_one_active`'s single active slot in the same tick, not the
    // next one) or refresh snapshots (which already no-ops once
    // getActiveBingo() stops returning the now-'complete' bingo — see
    // isBingoPastEnd's doc comment for the belt-and-braces D3 freeze this
    // sits alongside).
    await completeEndedBingos();
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
