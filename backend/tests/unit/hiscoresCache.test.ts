/**
 * services/hiscores.ts's hiscore_cache wiring (#56): a short-TTL cache sits
 * below the live OSRS call. A fresh cache hit skips the network call
 * entirely; a live success writes through; an unranked (404) result is
 * never cached (services/rsnChangeDetection.ts owns that path); and a live
 * failure after retries falls back to a stale cache entry instead of
 * failing outright. Mocks db/hiscoreCache.ts (no real Supabase) and
 * globalThis.fetch (no real OSRS network call).
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { HiscoreData } from "../../src/types/index.js";

function fakeHiscoreData(rsn: string, xp = 100): HiscoreData {
  return {
    name: rsn,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp }],
    activities: [],
    updatedAt: new Date(),
  };
}

/** Shapes a Hiscores Lite 2 response the way the real OSRS API returns it. */
function osrsLiteResponse(data: HiscoreData): Response {
  return new Response(
    JSON.stringify({
      name: data.name,
      skills: data.skills,
      activities: data.activities.map(({ id, name, rank, kc }) => ({ id, name, rank, score: kc })),
    }),
    { status: 200 },
  );
}

const getCachedHiscoreDataMock = mock(
  async (_rsn: string): Promise<{ data: HiscoreData; updatedAt: string } | null> => null,
);
const upsertHiscoreCacheMock = mock(async (_rsn: string, _payload: HiscoreData): Promise<void> => {});

mock.module("../../src/db/hiscoreCache.js", () => ({
  getCachedHiscoreData: getCachedHiscoreDataMock,
  upsertHiscoreCache: upsertHiscoreCacheMock,
}));

const { hiscores } = await import("../../src/services/hiscores.js");

const originalFetch = globalThis.fetch;

beforeEach(() => {
  getCachedHiscoreDataMock.mockClear();
  upsertHiscoreCacheMock.mockClear();
  getCachedHiscoreDataMock.mockImplementation(async () => null);
  upsertHiscoreCacheMock.mockImplementation(async () => {});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("hiscores() — hiscore_cache wiring", () => {
  test("a fresh cache entry short-circuits the live OSRS call entirely", async () => {
    const cached = fakeHiscoreData("Zezima", 500);
    getCachedHiscoreDataMock.mockImplementation(async () => ({
      data: cached,
      updatedAt: new Date().toISOString(),
    }));
    globalThis.fetch = mock(() => {
      throw new Error("must not be called — a fresh cache hit should have short-circuited this");
    }) as unknown as typeof fetch;

    const result = await hiscores("Zezima");
    expect(result?.skills[0].xp).toBe(500);
  });

  test("a stale (past-TTL) cache entry is ignored in favor of a live call, and the fresh result is written through", async () => {
    const stale = fakeHiscoreData("Zezima", 100);
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min old, TTL is 5
    getCachedHiscoreDataMock.mockImplementation(async () => ({ data: stale, updatedAt: staleTimestamp }));

    const live = fakeHiscoreData("Zezima", 999);
    globalThis.fetch = mock(() => Promise.resolve(osrsLiteResponse(live))) as unknown as typeof fetch;

    const result = await hiscores("Zezima");
    expect(result?.skills[0].xp).toBe(999);
    expect(upsertHiscoreCacheMock).toHaveBeenCalledTimes(1);
    expect(upsertHiscoreCacheMock.mock.calls[0]?.[0]).toBe("Zezima");
  });

  test("an unranked (404) result is returned as null and is never written to the cache", async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 404 }))) as unknown as typeof fetch;

    const result = await hiscores("NobodyOnHiscores");
    expect(result).toBeNull();
    expect(upsertHiscoreCacheMock).not.toHaveBeenCalled();
  });

  test(
    "a live failure after retries falls back to a stale cached entry instead of throwing",
    async () => {
      const stale = fakeHiscoreData("Zezima", 42);
      const staleTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour old
      getCachedHiscoreDataMock.mockImplementation(async () => ({ data: stale, updatedAt: staleTimestamp }));
      globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 503 }))) as unknown as typeof fetch;

      const result = await hiscores("Zezima");
      expect(result?.skills[0].xp).toBe(42);
    },
    15_000,
  );

  test(
    "a live failure after retries with no cached entry still throws (unchanged pre-#56 behavior)",
    async () => {
      getCachedHiscoreDataMock.mockImplementation(async () => null);
      globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 503 }))) as unknown as typeof fetch;

      await expect(hiscores("NeverCached")).rejects.toThrow(/Failed to fetch hiscore data/);
    },
    15_000,
  );

  test("a cache-read failure is non-fatal — falls through to a live call instead of rejecting", async () => {
    getCachedHiscoreDataMock.mockImplementation(async () => {
      throw new Error("hiscore_cache unavailable");
    });
    const live = fakeHiscoreData("Zezima", 7);
    globalThis.fetch = mock(() => Promise.resolve(osrsLiteResponse(live))) as unknown as typeof fetch;

    const result = await hiscores("Zezima");
    expect(result?.skills[0].xp).toBe(7);
  });
});
