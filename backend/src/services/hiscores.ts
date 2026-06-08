import { HiscoreData } from "../types/index.js";

const HISCORES_URL = "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch raw hiscore JSON from the OSRS API with retry on transient errors.
 * Returns null if the player is unranked (404) or genuinely not on hiscores.
 * Throws on persistent network/server errors after MAX_RETRIES attempts.
 */
async function getHiscoreData(rsn: string): Promise<{
  name: string;
  skills: Array<{ id: number; name: string; rank: number; level: number; xp: number }>;
  activities: Array<{ id: number; name: string; rank: number; score: number }>;
} | null> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `${HISCORES_URL}?player=${encodeURIComponent(rsn)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10_000), // 10 s timeout per request
        },
      );

      // 404 = player not on hiscores (unranked or RSN doesn't exist)
      if (response.status === 404) {
        console.warn(`[hiscores] Player "${rsn}" not found on hiscores (404).`);
        return null;
      }

      // Retry on server-side errors
      if (response.status >= 500) {
        throw new Error(`OSRS hiscores server error: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Unexpected HTTP status: ${response.status}`);
      }

      return await response.json() as Awaited<ReturnType<typeof getHiscoreData>>;
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES) {
        console.warn(`[hiscores] Attempt ${attempt}/${MAX_RETRIES} failed for "${rsn}", retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS * attempt); // linear back-off
      }
    }
  }

  console.error(`[hiscores] All ${MAX_RETRIES} attempts failed for "${rsn}":`, lastError);
  throw new Error(`Failed to fetch hiscore data for "${rsn}" after ${MAX_RETRIES} attempts`);
}

/**
 * Fetch and format OSRS hiscores for a given RSN.
 *
 * Returns null if the player is unranked / not found on the OSRS hiscores.
 * Throws only on genuine network / server failures (after retries).
 *
 * @see https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2
 */
export async function hiscores(rsn: string): Promise<HiscoreData | null> {
  const raw = await getHiscoreData(rsn);

  if (!raw) return null; // unranked player

  const formattedActivities = raw.activities.map(({ id, name, rank, score }) => ({
    id,
    name,
    rank,
    kc: score,
  }));

  return {
    name: raw.name,
    skills: raw.skills,
    activities: formattedActivities,
    updatedAt: new Date(),
  };
}
