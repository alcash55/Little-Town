/**
 * D3 regression coverage (TEAM-BRIEF.md Sprint 14): the stats cron used to
 * keep upserting 'current' snapshots for a bingo whose end_date had already
 * passed — bingo.status stays 'active' until an admin (or a future
 * dedicated job) explicitly closes it out, so nothing gated the write on
 * the bingo's actual scoring window. Prod history showed 20-minute ticks
 * still running 17 days after end_date; post-bingo gains kept completing
 * tiles forever. Fixed via services/playerSnapshotCron.ts's
 * isBingoPastEnd() freeze check inside refreshAllPlayerSnapshots (unit
 * coverage for the pure predicate itself lives in
 * tests/unit/playerSnapshotCron.test.ts) — this file proves the freeze
 * actually withholds the DB write end-to-end against the real local stack,
 * and that a still-live bingo is unaffected.
 *
 * Runs against the real bingos/bingo_players/bingo_player_hiscores tables
 * on the local Supabase stack — only services/hiscores.ts (the real OSRS
 * network call) is mocked.
 */
import { describe, test, expect, afterAll, beforeEach, mock } from "bun:test";

import { getDb } from "../../src/db/client.js";
import type { HiscoreData } from "../../src/types/index.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  countHiscoreRows,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[player-snapshot-cron-end-freeze.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[player-snapshot-cron-end-freeze.test.ts] skipping: another bingo is already active in the shared local stack",
  );
}
const suite = stack.reachable && !preexistingActive;

// -------------------------------------------------------
// Mock services/hiscores.ts — the only network-touching dependency of
// refreshAllPlayerSnapshots. Everything else hits the real local DB.
// -------------------------------------------------------

function fakeHiscoreData(xp: number): HiscoreData {
  return {
    name: "TestRsn",
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp }],
    activities: [],
    updatedAt: new Date(),
  };
}

// Every call returns fresh, higher XP than whatever was seeded — if the
// freeze fails to withhold the write, the post-freeze assertions below
// (unchanged xp/taken_at) fail loudly rather than coincidentally passing.
let callCount = 0;
const hiscoresMock = mock(async (): Promise<HiscoreData | null> => {
  callCount += 1;
  return fakeHiscoreData(50_000_000 + callCount);
});

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* the mock above is registered so
// playerSnapshotCron.js resolves the mocked hiscores module.
const { refreshAllPlayerSnapshots } = await import("../../src/services/playerSnapshotCron.js");
const { savePlayerSnapshot } = await import("../../src/db/players.js");

beforeEach(() => {
  hiscoresMock.mockClear();
  callCount = 0;
});

const createdBingoIds: string[] = [];

async function insertTestPlayer(bingoId: string, rsn: string): Promise<string> {
  const { data, error } = await getDb()
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert test player "${rsn}": ${error?.message}`);
  return (data as { id: string }).id;
}

describe.skipIf(!suite)("refreshAllPlayerSnapshots — end_date freeze (D3)", () => {
  let bingo: BingoRow;
  let playerId: string;
  const rsn = `CronFreezePlayer${uniqueSuffix()}`;
  const seededXp = 12_345;

  test("fixtures: active bingo whose end_date is already in the past, one player with start+current snapshots", async () => {
    const pastEnd = new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(); // 17 days ago, matching the prod repro
    bingo = await insertTestBingo(`test-cron-freeze-${uniqueSuffix()}`, {
      status: "active",
      end_date: pastEnd,
    });
    createdBingoIds.push(bingo.id);
    expect(bingo.end_date).not.toBeNull();

    playerId = await insertTestPlayer(bingo.id, rsn);
    await savePlayerSnapshot(playerId, "start", fakeHiscoreData(0));
    await savePlayerSnapshot(playerId, "current", fakeHiscoreData(seededXp));
  });

  test("refreshAllPlayerSnapshots is a no-op for a bingo past its end_date: no hiscore lookups, 'current' unchanged", async () => {
    const before = await getDb()
      .from("bingo_player_hiscores")
      .select("skills, taken_at")
      .eq("player_id", playerId)
      .eq("type", "current")
      .single();

    const { succeeded, failed } = await refreshAllPlayerSnapshots();

    expect(succeeded).toBe(0);
    expect(failed).toEqual([]);
    // The freeze must short-circuit before even fetching the roster —
    // no OSRS lookups fired at all for the frozen bingo.
    expect(hiscoresMock).not.toHaveBeenCalled();

    const after = await getDb()
      .from("bingo_player_hiscores")
      .select("skills, taken_at")
      .eq("player_id", playerId)
      .eq("type", "current")
      .single();

    expect(after.data).toEqual(before.data);
    expect(await countHiscoreRows(playerId, "current")).toBe(1);
  });

  test("clearing end_date un-freezes the same bingo: refreshAllPlayerSnapshots now writes a fresh 'current'", async () => {
    const { error } = await getDb().from("bingos").update({ end_date: null }).eq("id", bingo.id);
    if (error) throw new Error(`Failed to clear end_date: ${error.message}`);

    const { succeeded, failed } = await refreshAllPlayerSnapshots();

    expect(succeeded).toBe(1);
    expect(failed).toEqual([]);
    expect(hiscoresMock).toHaveBeenCalledTimes(1);

    const after = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("player_id", playerId)
      .eq("type", "current")
      .single();
    const skills = (after.data as { skills: Array<{ xp: number }> }).skills;
    expect(skills[0].xp).not.toBe(seededXp);
    expect(skills[0].xp).toBeGreaterThan(seededXp);
  });

  test("a future end_date also leaves the bingo live (not frozen)", async () => {
    const futureEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await getDb().from("bingos").update({ end_date: futureEnd }).eq("id", bingo.id);
    if (error) throw new Error(`Failed to set future end_date: ${error.message}`);

    hiscoresMock.mockClear();
    const { succeeded } = await refreshAllPlayerSnapshots();

    expect(succeeded).toBe(1);
    expect(hiscoresMock).toHaveBeenCalledTimes(1);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
