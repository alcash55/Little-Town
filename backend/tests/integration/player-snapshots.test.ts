import { describe, test, expect, afterAll } from "bun:test";

import { savePlayerSnapshot } from "../../src/db/players.js";
import type { HiscoreData } from "../../src/types/index.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  deleteTestBingo,
  countHiscoreRows,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";
import { getDb } from "../../src/db/client.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[player-snapshots.test.ts] skipping: ${stack.reason}`);
}

const createdBingoIds: string[] = [];

function buildHiscoreData(overrides: Partial<HiscoreData> = {}): HiscoreData {
  return {
    name: "TestRsn",
    skills: [{ id: 0, name: "Overall", rank: 1000, level: 100, xp: 1_000_000 }],
    activities: [{ id: 0, name: "Clue Scrolls (all)", rank: 500, kc: 10 }],
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Insert a bingo_players row directly — registerBingoPlayer is covered by its own suite. */
async function insertTestPlayer(bingoId: string, rsn: string): Promise<string> {
  const { data, error } = await getDb()
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert test player "${rsn}": ${error?.message}`);
  return (data as { id: string }).id;
}

describe.skipIf(!stack.reachable)("savePlayerSnapshot idempotency", () => {
  let bingo: BingoRow;
  let playerId: string;
  const rsn = `SnapshotPlayer${uniqueSuffix()}`;

  test("fixtures: bingo with one player", async () => {
    bingo = await insertTestBingo(`test-snapshots-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    playerId = await insertTestPlayer(bingo.id, rsn);
  });

  test("'start' snapshot is created on first save", async () => {
    const first = buildHiscoreData({ skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 0 }] });
    const saved = await savePlayerSnapshot(playerId, "start", first);

    expect(saved.type).toBe("start");
    expect(saved.skills).toEqual(first.skills);
    expect(await countHiscoreRows(playerId, "start")).toBe(1);
  });

  test("'start' is never overwritten by a later save", async () => {
    const firstSnapshotRows = await getDb()
      .from("bingo_player_hiscores")
      .select("*")
      .eq("player_id", playerId)
      .eq("type", "start")
      .single();
    const originalId = (firstSnapshotRows.data as { id: string }).id;
    const originalSkills = (firstSnapshotRows.data as { skills: unknown }).skills;

    const second = buildHiscoreData({
      skills: [{ id: 0, name: "Overall", rank: 999, level: 99, xp: 99_999_999 }],
    });
    const saved = await savePlayerSnapshot(playerId, "start", second);

    // Same row, original data preserved — the second call's data must be ignored.
    expect(saved.id).toBe(originalId);
    expect(saved.skills).toEqual(originalSkills as HiscoreData["skills"]);
    expect(saved.skills).not.toEqual(second.skills);
    expect(await countHiscoreRows(playerId, "start")).toBe(1);
  });

  test("'current' snapshot is created on first save", async () => {
    const first = buildHiscoreData({ skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 0 }] });
    const saved = await savePlayerSnapshot(playerId, "current", first);

    expect(saved.type).toBe("current");
    expect(saved.skills).toEqual(first.skills);
    expect(await countHiscoreRows(playerId, "current")).toBe(1);
  });

  test("'current' upserts in place on subsequent saves — no duplicate rows", async () => {
    const currentRowBefore = await getDb()
      .from("bingo_player_hiscores")
      .select("id")
      .eq("player_id", playerId)
      .eq("type", "current")
      .single();
    const originalId = (currentRowBefore.data as { id: string }).id;

    const updated = buildHiscoreData({
      skills: [{ id: 0, name: "Overall", rank: 42, level: 42, xp: 4_200_000 }],
    });
    const saved = await savePlayerSnapshot(playerId, "current", updated);

    expect(saved.id).toBe(originalId);
    expect(saved.skills).toEqual(updated.skills);
    expect(await countHiscoreRows(playerId, "current")).toBe(1);
  });

  test("'start' and 'current' coexist as exactly one row each", async () => {
    expect(await countHiscoreRows(playerId, "start")).toBe(1);
    expect(await countHiscoreRows(playerId, "current")).toBe(1);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
