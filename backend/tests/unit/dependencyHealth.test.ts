/**
 * GET /api/admin/health/dependencies (TEAM-BRIEF.md Sprint 5, Track A item
 * 4). Pure unit test: mocks db/client.ts (no real Supabase call) and
 * globalThis.fetch (no real network to status.supabase.com / OSRS / the
 * Cloudflare status page), and asserts the frozen response contract's shape
 * plus the up/degraded/down/unknown mapping and the ~60s cache.
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
  stubFetch({});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getDependencyHealth", () => {
  test("returns all five contract services with the frozen field shape", async () => {
    const { services } = await getDependencyHealth();
    expect(services).toHaveLength(5);
    const ids = services.map((s) => s.id).sort();
    expect(ids).toEqual(["cloudflare-status", "osrs-hiscores", "self", "supabase-db", "supabase-status"].sort());

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

  test("results are cached — a second call within the TTL does not re-run the checks", async () => {
    await getDependencyHealth();
    fromMock.mockClear();
    globalThis.fetch = mock(() => Promise.reject(new Error("must not be called — should be cached"))) as unknown as typeof fetch;

    const { services } = await getDependencyHealth();
    expect(services).toHaveLength(5);
    expect(fromMock).not.toHaveBeenCalled();
  });

  test("resetting the cache forces a fresh round of checks", async () => {
    await getDependencyHealth();
    _resetDependencyHealthCacheForTests();
    fromMock.mockClear();
    await getDependencyHealth();
    expect(fromMock).toHaveBeenCalled();
  });
});
