import { describe, test, expect } from "bun:test";

import { mapWithConcurrency } from "../../src/lib/concurrency.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mapWithConcurrency — order", () => {
  test("results are returned in input order even when completions race", async () => {
    // Deliberately give earlier items longer delays than later ones, so if the
    // implementation naively pushed results as they resolved, order would break.
    const items = [
      { value: "a", delayMs: 30 },
      { value: "b", delayMs: 5 },
      { value: "c", delayMs: 20 },
      { value: "d", delayMs: 1 },
      { value: "e", delayMs: 15 },
    ];

    const results = await mapWithConcurrency(items, 3, async (item) => {
      await sleep(item.delayMs);
      return item.value;
    });

    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  test("passes each item's index to fn", async () => {
    const items = ["x", "y", "z"];
    const seen: number[] = [];

    await mapWithConcurrency(items, 2, async (_item, index) => {
      seen.push(index);
      return index;
    });

    expect(seen.sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  test("empty input resolves to an empty array", async () => {
    const results = await mapWithConcurrency([] as number[], 5, async (n) => n);
    expect(results).toEqual([]);
  });
});

describe("mapWithConcurrency — concurrency cap", () => {
  test("never runs more than `limit` calls at once", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;
    const limit = 3;

    await mapWithConcurrency(items, limit, async (item) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // Vary delay so workers interleave rather than lock-step.
      await sleep((item % 3) + 1);
      inFlight--;
      return item;
    });

    expect(maxInFlight).toBeLessThanOrEqual(limit);
    expect(maxInFlight).toBeGreaterThan(0);
  });

  test("limit <= 0 still processes all items using at least one worker", async () => {
    const items = [1, 2, 3];
    const results = await mapWithConcurrency(items, 0, async (n) => n * 2);

    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([2, 4, 6]);
  });

  test("limit larger than items.length caps the worker count at items.length", async () => {
    const items = [1, 2];
    let maxInFlight = 0;
    let inFlight = 0;

    await mapWithConcurrency(items, 100, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await sleep(5);
      inFlight--;
      return n;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});

describe("mapWithConcurrency — isolation", () => {
  test("one rejection does not abort or affect the other results (Promise.allSettled shape)", async () => {
    const items = [1, 2, 3, 4];

    const results = await mapWithConcurrency(items, 2, async (n) => {
      if (n === 2) throw new Error(`boom on ${n}`);
      await sleep(1);
      return n * 10;
    });

    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(results[1].status).toBe("rejected");
    if (results[1].status === "rejected") {
      expect((results[1].reason as Error).message).toBe("boom on 2");
    }
    expect(results[2]).toEqual({ status: "fulfilled", value: 30 });
    expect(results[3]).toEqual({ status: "fulfilled", value: 40 });
  });

  test("multiple rejections are each captured independently", async () => {
    const items = [1, 2, 3, 4, 5];

    const results = await mapWithConcurrency(items, 2, async (n) => {
      if (n % 2 === 0) throw new Error(`fail-${n}`);
      return n;
    });

    const statuses = results.map((r) => r.status);
    expect(statuses).toEqual(["fulfilled", "rejected", "fulfilled", "rejected", "fulfilled"]);
  });
});
