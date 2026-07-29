import { fetchHiscoreVocab } from "./hiscoreVocab.js";
import { upsertStaticData, getStaticDataUpdatedAt } from "../db/staticData.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let cronTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

/**
 * Fetches the authoritative skill/activity vocabulary from the real OSRS
 * hiscores API (TEAM-BRIEF.md Sprint 16, Track B — "one vocabulary, not
 * two") and saves it to the DB. If the probe lookup fails (network/hiscores
 * outage), this deliberately does NOT fall back to a different source —
 * there is no other source that's guaranteed to agree with what
 * completionEngine.ts matches tile task text against, which is the exact
 * two-vocabularies problem this sprint closes. Previously-served data (if
 * any) is left in place and a loud error is logged; the next cron tick
 * retries.
 */
export async function refreshStaticData(): Promise<void> {
  console.log("[staticDataCron] Refreshing static data...");

  try {
    const vocab = await fetchHiscoreVocab();
    const results = await Promise.allSettled([
      upsertStaticData("skills", vocab.skills),
      upsertStaticData("activities", vocab.activities),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[staticDataCron] Error during refresh:", result.reason);
      }
    }
    console.log("[staticDataCron] Refresh complete.");
  } catch (e) {
    console.error(
      "[staticDataCron] Authoritative hiscores vocabulary probe failed — keeping previously-served " +
        "data in place rather than serving anything not sourced from the real hiscores API:",
      e,
    );
  }
}

/**
 * Checks if either key is stale (older than 24hrs or empty) and refreshes if so.
 * Then schedules itself to run again in 24hrs.
 */
async function tick(): Promise<void> {
  try {
    const [skillsTs, activitiesTs] = await Promise.all([
      getStaticDataUpdatedAt("skills"),
      getStaticDataUpdatedAt("activities"),
    ]);

    const now = Date.now();
    const skillsStale = !skillsTs || now - new Date(skillsTs).getTime() >= ONE_DAY_MS;
    const activitiesStale = !activitiesTs || now - new Date(activitiesTs).getTime() >= ONE_DAY_MS;

    if (skillsStale || activitiesStale) {
      await refreshStaticData();
    } else {
      console.log("[staticDataCron] Static data is fresh, skipping refresh.");
    }
  } catch (e) {
    console.error("[staticDataCron] Tick error:", e);
  }

  // A stop() call during this in-flight tick must not resurrect the timer.
  if (stopped) return;

  // Schedule next run in 24 hours
  cronTimer = setTimeout(tick, ONE_DAY_MS);
}

/**
 * Starts the cron job. Runs immediately on startup, then every 24 hours.
 */
export function startStaticDataCron(): void {
  console.log("[staticDataCron] Starting...");
  stopped = false;
  tick();
}

/**
 * Stops the cron job (useful for graceful shutdown).
 */
export function stopStaticDataCron(): void {
  stopped = true;
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
    console.log("[staticDataCron] Stopped.");
  }
}
