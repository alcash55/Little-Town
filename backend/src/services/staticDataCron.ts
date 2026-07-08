import scrapeWiki from "./scrapeWiki.js";
import { upsertStaticData, getStaticDataUpdatedAt } from "../db/staticData.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let cronTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

/**
 * Scrapes skills and activities from the wiki and saves them to the DB.
 */
export async function refreshStaticData(): Promise<void> {
  console.log("[staticDataCron] Refreshing static data...");

  const results = await Promise.allSettled([
    scrapeWiki("skills", { bypassCache: true }).then((data) => upsertStaticData("skills", data)),
    scrapeWiki("activities", { bypassCache: true }).then((data) => upsertStaticData("activities", data)),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[staticDataCron] Error during refresh:", result.reason);
    }
  }

  console.log("[staticDataCron] Refresh complete.");
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
