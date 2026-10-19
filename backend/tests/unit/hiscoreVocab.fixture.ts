/**
 * services/hiscoreVocab.ts (TEAM-BRIEF.md Sprint 16, Track B item 1 — "one
 * vocabulary, not two"). Pure unit test: mocks services/hiscores.ts so no
 * real OSRS network call happens, and asserts the probe's skill/activity
 * names are extracted in the order the API returns them and that a
 * null/unranked probe result throws rather than silently returning an
 * empty vocabulary (which staticDataCron.ts would otherwise happily
 * persist as if it were real).
 */
import { describe, expect, mock, test } from "bun:test";

const hiscoresMock = mock(async (_rsn: string) => ({
  name: "Zezima",
  skills: [
    { id: 0, name: "Overall", rank: 1, level: 2277, xp: 4600000000 },
    { id: 20, name: "Runecraft", rank: 500, level: 99, xp: 13034431 },
  ],
  activities: [
    { id: 0, name: "Bounty Hunter", rank: -1, kc: -1 },
    { id: 62, name: "Calvar'ion", rank: 1000, kc: 42 },
  ],
  updatedAt: new Date(),
}));

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

const { fetchHiscoreVocab, VOCAB_PROBE_RSN } = await import("../../src/services/hiscoreVocab.js");

describe("fetchHiscoreVocab", () => {
  test("extracts skill and activity names, in API order, from a real hiscores lookup", async () => {
    const vocab = await fetchHiscoreVocab();
    expect(vocab.skills).toEqual(["Overall", "Runecraft"]);
    expect(vocab.activities).toEqual(["Bounty Hunter", "Calvar'ion"]);
  });

  test("probes the documented well-known RSN, not a hardcoded per-call name", async () => {
    await fetchHiscoreVocab();
    expect(hiscoresMock).toHaveBeenCalledWith(VOCAB_PROBE_RSN);
  });

  test("throws (does not silently return an empty vocabulary) when the probe is unranked/not found", async () => {
    hiscoresMock.mockImplementationOnce(async () => null as unknown as Awaited<ReturnType<typeof hiscoresMock>>);
    await expect(fetchHiscoreVocab()).rejects.toThrow(/no data/i);
  });

  test("propagates a genuine network/server failure from the underlying hiscores lookup", async () => {
    hiscoresMock.mockImplementationOnce(async () => {
      throw new Error("OSRS hiscores server error: 503");
    });
    await expect(fetchHiscoreVocab()).rejects.toThrow(/503/);
  });
});
