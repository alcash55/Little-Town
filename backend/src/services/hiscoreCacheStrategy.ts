import type { HiscoreData } from "../types/index.js";

export interface HiscoreCacheStrategyDeps {
  getCached: () => Promise<{ data: HiscoreData; updatedAt: string } | null>;
  fetchLive: () => Promise<HiscoreData | null>;
  upsertCache: (data: HiscoreData) => Promise<void>;
}

/**
 * The #56 cache read/write policy for hiscores(): a cache hit within
 * `ttlMs` short-circuits the live call, a live success writes through, an
 * unranked (null) result is never cached, and a live failure falls back to
 * a stale cache entry instead of throwing.
 *
 * Pulled out of services/hiscores.ts as a plain, dependency-injected
 * function rather than tested through hiscores.ts's own module import,
 * because `bun:test`'s `mock.module` replaces a module for the whole
 * process, not per-file: tests/unit/dependencyHealth.test.ts,
 * tests/unit/hiscoreVocab.test.ts, and tests/unit/hiscoresRateLimit.test.ts
 * all already replace services/hiscores.js wholesale with a stub of their
 * own, so any test that needed to import the *real* hiscores.js would get
 * whichever of those stubs happened to load first. Testing this policy as
 * an isolated function with fake `deps` sidesteps that collision instead of
 * fighting it.
 */
export async function resolveHiscoreWithCache(
  rsn: string,
  ttlMs: number,
  deps: HiscoreCacheStrategyDeps,
): Promise<HiscoreData | null> {
  const cached = await deps.getCached().catch((e) => {
    console.error(`[hiscores] Failed to read hiscore_cache for "${rsn}" — falling through to a live call:`, e);
    return null;
  });

  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < ttlMs) {
    return { ...cached.data, updatedAt: new Date(cached.data.updatedAt) };
  }

  let live: HiscoreData | null;
  try {
    live = await deps.fetchLive();
  } catch (e) {
    if (cached) {
      console.warn(
        `[hiscores] Live lookup for "${rsn}" failed after retries — serving the cached snapshot from ` +
          `${cached.updatedAt} instead of failing outright.`,
      );
      return { ...cached.data, updatedAt: new Date(cached.data.updatedAt) };
    }
    throw e;
  }

  if (!live) return null; // unranked player — never cached, see hiscores.ts's doc comment

  await deps.upsertCache(live).catch((e) => {
    // Cache-write failure must never fail the lookup itself — the caller
    // already has real, live data at this point.
    console.error(`[hiscores] Failed to write hiscore_cache for "${rsn}" (non-fatal):`, e);
  });

  return live;
}
