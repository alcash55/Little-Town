/**
 * services/staticDataCron.ts's refreshStaticData() (TEAM-BRIEF.md Sprint 16,
 * Track B item 1 — "one vocabulary, not two"). Pure unit test: mocks
 * services/hiscores.ts's hiscores() (no real OSRS network call) and
 * db/staticData.ts's upsertStaticData (no real Supabase call), and asserts
 * refreshStaticData() sources both lists from the single hiscores probe and
 * leaves previously-served data untouched (rather than wiping it, or
 * falling back to a different, potentially-diverging source) when that
 * probe fails.
 *
 * Deliberately mocks hiscores.ts rather than services/hiscoreVocab.ts, so
 * the real (pure, fast) fetchHiscoreVocab() logic runs here too —
 * `bun:test`'s `mock.module` replaces a module for the whole process, not
 * per-file, and tests/unit/dependencyHealth.test.ts and
 * tests/unit/hiscoreVocab.test.ts both need the real hiscoreVocab.ts as
 * well; mocking it here too would have whichever file's mock.module call
 * happens to register last silently shadow the others'.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";

function rawHiscoreResponse(skills: string[], activities: string[]) {
  return {
    name: "Zezima",
    skills: skills.map((name, i) => ({ id: i, name, rank: 1, level: 1, xp: 0 })),
    activities: activities.map((name, i) => ({ id: i, name, rank: 1, kc: 0 })),
    updatedAt: new Date(),
  };
}

const DEFAULT_SKILLS = ["Overall", "Runecraft"];
const DEFAULT_ACTIVITIES = ["Bounty Hunter", "Calvar'ion"];

const hiscoresMock = mock(async (_rsn: string) => rawHiscoreResponse(DEFAULT_SKILLS, DEFAULT_ACTIVITIES));
mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

const upsertStaticDataMock = mock(async (_key: string, _data: string[]) => {});
// Also stubs getStaticData, unused by this file's code under test, purely
// so this mock.module registration's export shape stays superset-compatible
// with tests/unit/dependencyHealth.test.ts's own mock of the same specifier
// — see that file's comment for why.
mock.module("../../src/db/staticData.js", () => ({
  upsertStaticData: upsertStaticDataMock,
  getStaticDataUpdatedAt: mock(async () => null),
  getStaticData: mock(async () => []),
}));

const { refreshStaticData } = await import("../../src/services/staticDataCron.js");

beforeEach(() => {
  hiscoresMock.mockClear();
  hiscoresMock.mockImplementation(async () => rawHiscoreResponse(DEFAULT_SKILLS, DEFAULT_ACTIVITIES));
  upsertStaticDataMock.mockClear();
});

describe("refreshStaticData", () => {
  test("persists both lists straight from the single hiscores probe — no separate wiki source", async () => {
    await refreshStaticData();
    expect(upsertStaticDataMock).toHaveBeenCalledWith("skills", ["Overall", "Runecraft"]);
    expect(upsertStaticDataMock).toHaveBeenCalledWith("activities", ["Bounty Hunter", "Calvar'ion"]);
    expect(upsertStaticDataMock).toHaveBeenCalledTimes(2);
  });

  test("a failed hiscores probe leaves previously-served data untouched — no upsert at all", async () => {
    hiscoresMock.mockImplementation(async () => {
      throw new Error("network unreachable");
    });
    await expect(refreshStaticData()).resolves.toBeUndefined(); // never throws — caller (cron tick) must keep running
    expect(upsertStaticDataMock).not.toHaveBeenCalled();
  });
});
