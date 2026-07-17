/**
 * D2 regression coverage (TEAM-BRIEF.md Sprint 14): a player's 'start'
 * snapshot is normally taken once at registration and, via
 * upsert_player_hiscore_start's insert-if-absent RPC, never moves again on
 * its own. That's correct for registration races and mid-bingo claims, but
 * it's WRONG for bingo activation — the prod repro had giminpain
 * registered on June 1 while "yes sir" didn't activate until June 5, so the
 * old (never-retaken) start snapshot let 4 days of pre-bingo XP/KC gains
 * count toward every tile.
 *
 * Fix: bingoActivation.ts's snapshotStartAndCurrent now takes a
 * `retakeExisting` flag (default false, preserving the old insert-if-absent
 * behavior everywhere else — e.g. retake-start-snapshots, see
 * activation-force.test.ts's idempotency coverage) that activation alone
 * sets to true via takeActivationSnapshots -> activateBingoWithSnapshots,
 * clearing any pre-existing start row (db/players.ts's clearStartSnapshot)
 * before writing a fresh one. Activation time IS the baseline.
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
  console.warn(`[activation-retakes-start.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[activation-retakes-start.test.ts] skipping: another bingo is already active in the shared local stack",
  );
}
const suite = stack.reachable && !preexistingActive;

// -------------------------------------------------------
// Mock services/hiscores.ts — the only network-touching dependency.
// -------------------------------------------------------

function fakeHiscoreData(xp: number): HiscoreData {
  return {
    name: "TestRsn",
    skills: [{ id: 0, name: "Hitpoints", rank: 1, level: 1, xp }],
    activities: [],
    updatedAt: new Date(),
  };
}

/** XP the mocked hiscores lookup returns for every RSN at "activation time". */
const ACTIVATION_TIME_XP = 500_215; // matches the prod repro's giminpain HP XP scale
const hiscoresMock = mock(async (): Promise<HiscoreData | null> => fakeHiscoreData(ACTIVATION_TIME_XP));

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* the mock above is registered.
const { activateBingoWithSnapshots, snapshotStartAndCurrent } = await import(
  "../../src/services/bingoActivation.js"
);
const { savePlayerSnapshot } = await import("../../src/db/players.js");

beforeEach(() => {
  hiscoresMock.mockClear();
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

describe.skipIf(!suite)("bingo activation retakes existing start snapshots (D2)", () => {
  let bingo: BingoRow;
  let playerId: string;
  const rsn = `RetakeStartPlayer${uniqueSuffix()}`;
  // XP the player had at REGISTRATION time, days before activation — much
  // lower than ACTIVATION_TIME_XP, simulating real pre-bingo gameplay in
  // between (exactly the "gains between registration and activation" case
  // the fix contract calls out).
  const REGISTRATION_TIME_XP = 10_000;

  test("fixtures: draft bingo with a player who already has a start snapshot from registration", async () => {
    bingo = await insertTestBingo(`test-retake-start-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    playerId = await insertTestPlayer(bingo.id, rsn);

    // Simulates registration having already taken start+current snapshots
    // (as routes/admin.ts's player-registration route does today) BEFORE
    // this test's activation call.
    await savePlayerSnapshot(playerId, "start", fakeHiscoreData(REGISTRATION_TIME_XP));
    await savePlayerSnapshot(playerId, "current", fakeHiscoreData(REGISTRATION_TIME_XP));
    expect(await countHiscoreRows(playerId, "start")).toBe(1);

    const { data } = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("player_id", playerId)
      .eq("type", "start")
      .single();
    expect((data as { skills: Array<{ xp: number }> }).skills[0].xp).toBe(REGISTRATION_TIME_XP);
  });

  test("activation REPLACES the pre-existing start snapshot with a fresh activation-time baseline", async () => {
    const outcome = await activateBingoWithSnapshots(bingo.id, { source: "drafter" });

    expect(outcome.activated).toBe(true);
    expect(outcome.blocked).toBe(false);
    expect(outcome.succeeded).toBe(1);

    // Still exactly one start row — replaced in place, not duplicated.
    expect(await countHiscoreRows(playerId, "start")).toBe(1);

    const { data } = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("player_id", playerId)
      .eq("type", "start")
      .single();
    const startXp = (data as { skills: Array<{ xp: number }> }).skills[0].xp;

    // The pre-bingo registration-time XP must be GONE from the new
    // baseline — this is the actual bug: without the fix this assertion
    // fails because upsert_player_hiscore_start's insert-if-absent RPC
    // silently keeps the old row.
    expect(startXp).not.toBe(REGISTRATION_TIME_XP);
    expect(startXp).toBe(ACTIVATION_TIME_XP);
  });

  test("gains between registration and activation do NOT count: start == current immediately post-activation", async () => {
    const { data: startRow } = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("player_id", playerId)
      .eq("type", "start")
      .single();
    const { data: currentRow } = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("player_id", playerId)
      .eq("type", "current")
      .single();

    const startXp = (startRow as { skills: Array<{ xp: number }> }).skills[0].xp;
    const currentXp = (currentRow as { skills: Array<{ xp: number }> }).skills[0].xp;

    // Both snapshots were taken from the SAME activation-time hiscore
    // fetch, so the delta a tile would compute is exactly 0 — none of the
    // (REGISTRATION_TIME_XP -> ACTIVATION_TIME_XP) pre-bingo gain leaks
    // into the bingo's scoring.
    expect(currentXp - startXp).toBe(0);
  });

  test("contrast: snapshotStartAndCurrent WITHOUT retakeExisting (the default) still leaves an existing start alone", async () => {
    // Re-run the underlying snapshot step directly, as retake-start-
    // snapshots (routes/admin.ts) would for a player who already has a
    // start row — must remain a no-op for 'start' (only 'current' moves).
    hiscoresMock.mockClear();
    const before = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("player_id", playerId)
      .eq("type", "start")
      .single();

    await snapshotStartAndCurrent(
      [{ id: playerId, bingo_id: bingo.id, team_id: null, captain_team_id: null, rsn, registered_by: null, registered_at: new Date().toISOString() }],
      "drafter",
    );

    const after = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("player_id", playerId)
      .eq("type", "start")
      .single();

    expect(after.data).toEqual(before.data);
    expect(await countHiscoreRows(playerId, "start")).toBe(1);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
