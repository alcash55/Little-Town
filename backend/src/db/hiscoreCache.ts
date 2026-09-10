import { getDb } from "./client.js";
import type { HiscoreData } from "../types/index.js";

// -------------------------------------------------------
// hiscore_cache (#56) — a short-TTL cache of the raw hiscores() payload,
// keyed by RSN. Sits strictly below services/hiscores.ts as a load/
// resilience layer; it is NOT the app's scoring source of truth (that's
// bingo_player_hiscores' start/current snapshots, taken at fixed points —
// registration, activation, the 20-minute cron — regardless of what this
// cache holds at the time). See services/hiscores.ts for the read/write
// policy.
// -------------------------------------------------------

export interface HiscoreCacheEntry {
  data: HiscoreData;
  updatedAt: string;
}

/**
 * hiscore_cache.player_name is case-sensitive (a plain TEXT primary key), so
 * two callers looking up the same real account under different casing
 * (stored `bingo_players.rsn` vs. free-text admin/user input) would
 * otherwise miss each other's cache entry. Normalizing the lookup key here
 * — while still storing/returning the RSN's real casing inside `payload`
 * (services/hiscores.ts's `raw.name`, straight from the OSRS API) — is
 * cache-key hygiene only; it never changes what casing is shown anywhere.
 */
function cacheKey(rsn: string): string {
  return rsn.trim().toLowerCase();
}

/** Reads a cached hiscores() payload for `rsn`, or null if none is on file. */
export async function getCachedHiscoreData(rsn: string): Promise<HiscoreCacheEntry | null> {
  const db = getDb();
  const { data, error } = await db
    .from("hiscore_cache")
    .select("payload, updated_at")
    .eq("player_name", cacheKey(rsn))
    .maybeSingle();

  if (error) throw new Error(`Failed to read hiscore cache for "${rsn}": ${error.message}`);
  if (!data) return null;
  return { data: data.payload as HiscoreData, updatedAt: data.updated_at as string };
}

/** Writes (or replaces) the cached hiscores() payload for `rsn`. */
export async function upsertHiscoreCache(rsn: string, payload: HiscoreData): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("hiscore_cache")
    .upsert(
      { player_name: cacheKey(rsn), payload, updated_at: new Date().toISOString() },
      { onConflict: "player_name" },
    );

  if (error) throw new Error(`Failed to write hiscore cache for "${rsn}": ${error.message}`);
}
