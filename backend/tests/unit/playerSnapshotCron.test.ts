import { describe, test, expect } from "bun:test";

import { isBingoPastEnd } from "../../src/services/playerSnapshotCron.js";

/**
 * D3 regression coverage (TEAM-BRIEF.md Sprint 14): the stats cron used to
 * keep upserting 'current' snapshots for a bingo whose end_date had already
 * passed (prod history showed 20-minute ticks still running 17 days after
 * end_date) — post-bingo gains kept completing tiles forever. `isBingoPastEnd`
 * is the pure freeze predicate `refreshAllPlayerSnapshots` now gates on; see
 * tests/integration/player-snapshot-cron-end-freeze.test.ts for the
 * end-to-end DB-backed proof that the freeze actually withholds the write.
 */
describe("isBingoPastEnd", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");

  test("end_date in the past -> true (frozen)", () => {
    expect(isBingoPastEnd("2026-06-30T00:00:00.000Z", now)).toBe(true);
  });

  test("end_date in the future -> false (still live)", () => {
    expect(isBingoPastEnd("2026-08-01T00:00:00.000Z", now)).toBe(false);
  });

  test("end_date exactly now -> false (not past until strictly after)", () => {
    expect(isBingoPastEnd(now.toISOString(), now)).toBe(false);
  });

  test("null end_date -> false (no end configured yet, never frozen)", () => {
    expect(isBingoPastEnd(null, now)).toBe(false);
  });

  test("undefined end_date -> false", () => {
    expect(isBingoPastEnd(undefined, now)).toBe(false);
  });

  test("unparseable end_date -> false, not a throw (defensive — never brick the cron on bad data)", () => {
    expect(isBingoPastEnd("not-a-date", now)).toBe(false);
  });

  test("date-only string (no time component) compares correctly against a full ISO `now`", () => {
    // Mirrors how bingos.end_date can be stored/returned — a bare date
    // still parses to midnight UTC and compares correctly.
    expect(isBingoPastEnd("2026-06-30", now)).toBe(true);
    expect(isBingoPastEnd("2026-12-25", now)).toBe(false);
  });
});
