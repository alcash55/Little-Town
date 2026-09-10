/**
 * services/hiscoreCacheStrategy.ts's resolveHiscoreWithCache() (#56): a
 * short-TTL cache sits below the live OSRS call. A fresh cache hit skips
 * the live call entirely; a live success writes through; an unranked
 * (null) result is never cached (services/rsnChangeDetection.ts owns that
 * path); and a live failure after retries falls back to a stale cache
 * entry instead of failing outright.
 *
 * Exercises the function directly with plain fake `deps`, not through
 * services/hiscores.js's own `hiscores()` export. `bun:test`'s
 * `mock.module` replaces a module for the whole process, not per file, and
 * tests/unit/dependencyHealth.test.ts, tests/unit/hiscoreVocab.test.ts, and
 * tests/unit/hiscoresRateLimit.test.ts all already replace
 * services/hiscores.js wholesale with a stub of their own — importing the
 * real hiscores.js here would silently get whichever of those stubs
 * happened to load first instead. Dependency injection sidesteps that
 * collision instead of racing it.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { resolveHiscoreWithCache } from "../../src/services/hiscoreCacheStrategy.js";
import type { HiscoreData } from "../../src/types/index.js";

const TTL_MS = 5 * 60 * 1000;

function fakeHiscoreData(rsn: string, xp = 100): HiscoreData {
  return {
    name: rsn,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp }],
    activities: [],
    updatedAt: new Date(),
  };
}

let getCached: ReturnType<typeof mock<() => Promise<{ data: HiscoreData; updatedAt: string } | null>>>;
let fetchLive: ReturnType<typeof mock<() => Promise<HiscoreData | null>>>;
let upsertCache: ReturnType<typeof mock<(data: HiscoreData) => Promise<void>>>;

beforeEach(() => {
  getCached = mock(async () => null);
  fetchLive = mock(async () => fakeHiscoreData("Zezima"));
  upsertCache = mock(async () => {});
});

function deps() {
  return { getCached, fetchLive, upsertCache };
}

describe("resolveHiscoreWithCache()", () => {
  test("a fresh cache entry short-circuits the live call entirely", async () => {
    const cached = fakeHiscoreData("Zezima", 500);
    getCached.mockImplementation(async () => ({ data: cached, updatedAt: new Date().toISOString() }));
    fetchLive.mockImplementation(async () => {
      throw new Error("must not be called — a fresh cache hit should have short-circuited this");
    });

    const result = await resolveHiscoreWithCache("Zezima", TTL_MS, deps());
    expect(result?.skills[0].xp).toBe(500);
  });

  test("a stale (past-TTL) cache entry is ignored in favor of a live call, and the fresh result is written through", async () => {
    const stale = fakeHiscoreData("Zezima", 100);
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min old, TTL is 5
    getCached.mockImplementation(async () => ({ data: stale, updatedAt: staleTimestamp }));
    fetchLive.mockImplementation(async () => fakeHiscoreData("Zezima", 999));

    const result = await resolveHiscoreWithCache("Zezima", TTL_MS, deps());
    expect(result?.skills[0].xp).toBe(999);
    expect(upsertCache).toHaveBeenCalledTimes(1);
    expect(upsertCache.mock.calls[0]?.[0]?.skills[0].xp).toBe(999);
  });

  test("an unranked (null) result is returned as null and is never written to the cache", async () => {
    fetchLive.mockImplementation(async () => null);

    const result = await resolveHiscoreWithCache("NobodyOnHiscores", TTL_MS, deps());
    expect(result).toBeNull();
    expect(upsertCache).not.toHaveBeenCalled();
  });

  test("a live failure after retries falls back to a stale cached entry instead of throwing", async () => {
    const stale = fakeHiscoreData("Zezima", 42);
    const staleTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour old
    getCached.mockImplementation(async () => ({ data: stale, updatedAt: staleTimestamp }));
    fetchLive.mockImplementation(async () => {
      throw new Error("OSRS hiscores server error: 503");
    });

    const result = await resolveHiscoreWithCache("Zezima", TTL_MS, deps());
    expect(result?.skills[0].xp).toBe(42);
  });

  test("a live failure after retries with no cached entry still throws (unchanged pre-#56 behavior)", async () => {
    getCached.mockImplementation(async () => null);
    fetchLive.mockImplementation(async () => {
      throw new Error("Failed to fetch hiscore data for \"NeverCached\" after 3 attempts");
    });

    await expect(resolveHiscoreWithCache("NeverCached", TTL_MS, deps())).rejects.toThrow(
      /Failed to fetch hiscore data/,
    );
  });

  test("a cache-read failure is non-fatal — falls through to a live call instead of rejecting", async () => {
    getCached.mockImplementation(async () => {
      throw new Error("hiscore_cache unavailable");
    });
    fetchLive.mockImplementation(async () => fakeHiscoreData("Zezima", 7));

    const result = await resolveHiscoreWithCache("Zezima", TTL_MS, deps());
    expect(result?.skills[0].xp).toBe(7);
  });
});
