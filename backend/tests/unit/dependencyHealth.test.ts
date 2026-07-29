/**
 * GET /api/admin/health/dependencies (TEAM-BRIEF.md Sprint 5, Track A item
 * 4; Sprint 16, Track B item 2 added the `osrs-vocab-drift` check). Pure
 * unit test: mocks db/client.ts (no real Supabase call), db/staticData.ts's
 * getStaticData, and services/hiscores.ts's hiscores() (no real OSRS
 * network calls) — deliberately mocking hiscores.ts rather than
 * hiscoreVocab.ts, so the real (pure, fast) fetchHiscoreVocab() logic runs
 * here too. `bun:test`'s `mock.module` replaces a module for the whole
 * process, not per-file — tests/unit/staticDataCron.test.ts also exercises
 * fetchHiscoreVocab() for real over its own hiscores.ts mock, and
 * tests/unit/hiscoreVocab.test.ts unit-tests fetchHiscoreVocab() itself;
 * if this file mocked hiscoreVocab.ts directly instead, whichever of these
 * files' module mock happened to register last would silently shadow the
 * others'. Also mocks globalThis.fetch (no real network to
 * status.supabase.com / OSRS reachability probe / the Cloudflare status
 * page), and asserts the frozen response contract's shape plus the
 * up/degraded/down/unknown mapping and the ~60s cache.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const selectMock = mock(async () => ({ error: null as { message: string } | null }));
const fromMock = mock((_table: string) => ({
  select: (_cols: string, _opts: unknown) => ({
    limit: (_n: number) => selectMock(),
  }),
}));

mock.module("../../src/db/client.js", () => ({
  getDb: () => ({ from: fromMock }),
}));

const DEFAULT_SKILLS = ["Overall", "Attack", "Runecraft"];
const DEFAULT_ACTIVITIES = ["Bounty Hunter", "Calvar'ion"];

const getStaticDataMock = mock(async (key: string) =>
  key === "skills" ? [...DEFAULT_SKILLS] : [...DEFAULT_ACTIVITIES],
);
// Also stubs upsertStaticData/getStaticDataUpdatedAt, unused by this file's
// code under test, purely so this mock.module registration's export shape
// stays a superset-compatible with tests/unit/staticDataCron.test.ts's own
// mock of the same specifier — `bun:test`'s mock.module replaces a module
// for the whole process, not per-file, so whichever file's registration is
// active when the other runs must not be missing an export the other needs.
mock.module("../../src/db/staticData.js", () => ({
  getStaticData: getStaticDataMock,
  getStaticDataUpdatedAt: mock(async () => null),
  upsertStaticData: mock(async () => {}),
}));

function rawHiscoreResponse(skills: string[], activities: string[]) {
  return {
    name: "Zezima",
    skills: skills.map((name, i) => ({ id: i, name, rank: 1, level: 1, xp: 0 })),
    activities: activities.map((name, i) => ({ id: i, name, rank: 1, kc: 0 })),
    updatedAt: new Date(),
  };
}

const hiscoresMock = mock(async (_rsn: string) => rawHiscoreResponse(DEFAULT_SKILLS, DEFAULT_ACTIVITIES));
mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

const {
  getDependencyHealth,
  _resetDependencyHealthCacheForTests,
} = await import("../../src/services/dependencyHealth.js");

const originalFetch = globalThis.fetch;

function statuspageResponse(indicator: string): Response {
  return new Response(JSON.stringify({ status: { indicator, description: indicator } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Routes fetch by URL — every external check in dependencyHealth.ts goes through this. */
function stubFetch(opts: {
  supabaseIndicator?: string;
  cloudflareIndicator?: string;
  osrsStatus?: number | "network-error";
}): void {
  globalThis.fetch = mock((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("status.supabase.com")) {
      return Promise.resolve(statuspageResponse(opts.supabaseIndicator ?? "none"));
    }
    if (url.includes("cloudflarestatus.com")) {
      return Promise.resolve(statuspageResponse(opts.cloudflareIndicator ?? "none"));
    }
    if (url.includes("runescape.com")) {
      if (opts.osrsStatus === "network-error") return Promise.reject(new Error("ECONNRESET"));
      return Promise.resolve(new Response("{}", { status: opts.osrsStatus ?? 200 }));
    }
    return Promise.reject(new Error(`unexpected fetch in test: ${url}`));
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  _resetDependencyHealthCacheForTests();
  selectMock.mockClear();
  selectMock.mockImplementation(async () => ({ error: null }));
  fromMock.mockClear();
  getStaticDataMock.mockClear();
  getStaticDataMock.mockImplementation(async (key: string) =>
    key === "skills" ? [...DEFAULT_SKILLS] : [...DEFAULT_ACTIVITIES],
  );
  hiscoresMock.mockClear();
  hiscoresMock.mockImplementation(async () => rawHiscoreResponse(DEFAULT_SKILLS, DEFAULT_ACTIVITIES));
  stubFetch({});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getDependencyHealth", () => {
  test("returns all six contract services with the frozen field shape", async () => {
    const { services } = await getDependencyHealth();
    expect(services).toHaveLength(6);
    const ids = services.map((s) => s.id).sort();
    expect(ids).toEqual(
      ["cloudflare-status", "osrs-hiscores", "osrs-vocab-drift", "self", "supabase-db", "supabase-status"].sort(),
    );

    for (const service of services) {
      expect(typeof service.id).toBe("string");
      expect(typeof service.label).toBe("string");
      expect(["up", "degraded", "down", "unknown"]).toContain(service.status);
      expect(typeof service.latencyMs).toBe("number");
      expect(Number.isNaN(Date.parse(service.checkedAt))).toBe(false);
    }
  });

  test("all-healthy scenario: everything reports up", async () => {
    const { services } = await getDependencyHealth();
    for (const service of services) {
      expect(service.status).toBe("up");
    }
  });

  test("Supabase DB query error maps to down with the error message as detail", async () => {
    selectMock.mockImplementation(async () => ({ error: { message: "connection refused" } }));
    const { services } = await getDependencyHealth();
    const db = services.find((s) => s.id === "supabase-db")!;
    expect(db.status).toBe("down");
    expect(db.detail).toBe("connection refused");
  });

  test("statuspage indicator 'minor' maps to degraded, 'major' maps to down", async () => {
    stubFetch({ supabaseIndicator: "minor", cloudflareIndicator: "major" });
    const { services } = await getDependencyHealth();
    expect(services.find((s) => s.id === "supabase-status")!.status).toBe("degraded");
    expect(services.find((s) => s.id === "cloudflare-status")!.status).toBe("down");
  });

  test("OSRS hiscores 404 still counts as up (reachability probe, not player validity)", async () => {
    stubFetch({ osrsStatus: 404 });
    const { services } = await getDependencyHealth();
    expect(services.find((s) => s.id === "osrs-hiscores")!.status).toBe("up");
  });

  test("OSRS hiscores 5xx maps to down", async () => {
    stubFetch({ osrsStatus: 503 });
    const { services } = await getDependencyHealth();
    expect(services.find((s) => s.id === "osrs-hiscores")!.status).toBe("down");
  });

  test("OSRS hiscores network failure maps to down with a detail message", async () => {
    stubFetch({ osrsStatus: "network-error" });
    const { services } = await getDependencyHealth();
    const osrs = services.find((s) => s.id === "osrs-hiscores")!;
    expect(osrs.status).toBe("down");
    expect(osrs.detail).toBeTruthy();
  });

  test("osrs-vocab-drift is up when served vocabulary matches a fresh hiscores probe", async () => {
    const { services } = await getDependencyHealth();
    const drift = services.find((s) => s.id === "osrs-vocab-drift")!;
    expect(drift.status).toBe("up");
  });

  test("osrs-vocab-drift reports the specific differing names when served data lags the live probe", async () => {
    // Served vocabulary still has the legacy wiki-scraped "Runecrafting"
    // spelling; a fresh hiscores probe now returns the real "Runecraft".
    getStaticDataMock.mockImplementation(async (key: string) =>
      key === "skills" ? ["Overall", "Attack", "Runecrafting"] : [...DEFAULT_ACTIVITIES],
    );
    const { services } = await getDependencyHealth();
    const drift = services.find((s) => s.id === "osrs-vocab-drift")!;
    expect(drift.status).toBe("degraded");
    expect(drift.detail).toContain("Runecrafting");
    expect(drift.detail).toContain("Runecraft");
  });

  test("osrs-vocab-drift is unknown (not degraded) when nothing has been served yet", async () => {
    getStaticDataMock.mockImplementation(async () => []);
    const { services } = await getDependencyHealth();
    const drift = services.find((s) => s.id === "osrs-vocab-drift")!;
    expect(drift.status).toBe("unknown");
  });

  test("osrs-vocab-drift maps a failed hiscores probe to down", async () => {
    hiscoresMock.mockImplementation(async () => {
      throw new Error("probe RSN unreachable");
    });
    const { services } = await getDependencyHealth();
    const drift = services.find((s) => s.id === "osrs-vocab-drift")!;
    expect(drift.status).toBe("down");
    expect(drift.detail).toBeTruthy();
  });

  test("results are cached — a second call within the TTL does not re-run the checks", async () => {
    await getDependencyHealth();
    fromMock.mockClear();
    getStaticDataMock.mockClear();
    hiscoresMock.mockClear();
    globalThis.fetch = mock(() => Promise.reject(new Error("must not be called — should be cached"))) as unknown as typeof fetch;

    const { services } = await getDependencyHealth();
    expect(services).toHaveLength(6);
    expect(fromMock).not.toHaveBeenCalled();
    expect(getStaticDataMock).not.toHaveBeenCalled();
    expect(hiscoresMock).not.toHaveBeenCalled();
  });

  test("resetting the cache forces a fresh round of checks", async () => {
    await getDependencyHealth();
    _resetDependencyHealthCacheForTests();
    fromMock.mockClear();
    await getDependencyHealth();
    expect(fromMock).toHaveBeenCalled();
  });
});
