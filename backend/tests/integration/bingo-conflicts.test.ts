/**
 * Coverage for getBingoConflicts() (src/db/conflicts.ts) — GET
 * /api/bingo/:bingoId/conflicts's underlying detection query.
 *
 * Fixtures push individual history points directly via the
 * upsert_player_hiscore_current RPC (rather than savePlayerSnapshot(), which
 * now supports side accounts too — see services/sideAccountSnapshots.ts and
 * tests/integration/side-account-snapshots.test.ts — but goes through the
 * real OSRS hiscores API, which these fixtures need to bypass entirely).
 * Each RPC call with a distinct p_taken_at produces exactly one
 * bingo_player_hiscore_history row via the AFTER INSERT/UPDATE trigger from
 * 20260711000000_hiscore_conflict_history.sql, giving these tests full
 * control over each account's XP-over-time series without waiting on the
 * real cron.
 *
 * Skips cleanly (does not fail) if the local stack is unreachable, or if
 * that migration hasn't been applied yet.
 */
import { describe, test, expect, afterAll } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { getBingoConflicts } from "../../src/db/conflicts.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[bingo-conflicts.test.ts] skipping: ${stack.reason}`);
}

async function historyTableExists(): Promise<boolean> {
  const { error } = await getDb().from("bingo_player_hiscore_history").select("id").limit(0);
  if (!error) return true;
  // Postgres reports "relation does not exist" as 42P01.
  return (error as { code?: string }).code !== "42P01";
}

const migrationApplied = stack.reachable ? await historyTableExists() : false;
if (stack.reachable && !migrationApplied) {
  console.warn(
    "[bingo-conflicts.test.ts] skipping: bingo_player_hiscore_history table not found " +
      "(20260711000000_hiscore_conflict_history.sql not yet applied to this stack)",
  );
}

const suite = stack.reachable && migrationApplied;
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

async function insertTestSideAccount(playerId: string, rsn: string): Promise<string> {
  const { data, error } = await getDb()
    .from("bingo_player_side_accounts")
    .insert({ player_id: playerId, rsn })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert test side account "${rsn}": ${error?.message}`);
  return (data as { id: string }).id;
}

/**
 * Pushes one history point for either a primary account (sideAccountId
 * undefined) or a side account, by calling upsert_player_hiscore_current
 * directly. Repeated calls for the same target overwrite 'current' in
 * place (as in production) but each still appends its own history row via
 * the trigger, since taken_at changes every call.
 */
async function pushPoint(
  playerId: string,
  sideAccountId: string | undefined,
  totalXp: number,
  takenAt: Date,
): Promise<void> {
  const { error } = await getDb().rpc("upsert_player_hiscore_current", {
    p_player_id: playerId,
    p_side_account_id: sideAccountId ?? null,
    p_skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: totalXp }],
    p_activities: [],
    p_taken_at: takenAt.toISOString(),
  });
  if (error) throw new Error(`Failed to push history point: ${error.message}`);
}

function minutesAgo(base: Date, n: number): Date {
  return new Date(base.getTime() - n * 60_000);
}

describe.skipIf(!suite)("getBingoConflicts", () => {
  let bingo: BingoRow;

  // Player A: main gains XP, side account is flat -> no conflict.
  let playerANoConflict: string;
  let sideANoConflict: string;

  // Player B: main and side gain XP in exactly one overlapping window -> low.
  let playerBLow: string;
  let sideBLow: string;

  // Player C: main and side gain XP in two separate overlapping windows -> high.
  let playerCHigh: string;
  let sideCHigh: string;

  const now = new Date();
  const t0 = minutesAgo(now, 180);
  const t1 = minutesAgo(now, 120);
  const t2 = minutesAgo(now, 60);
  const t3 = minutesAgo(now, 0);

  test("fixtures: bingo with three (player, side account) pairs", async () => {
    bingo = await insertTestBingo(`test-conflicts-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);

    playerANoConflict = await insertTestPlayer(bingo.id, `ConflictMainA${uniqueSuffix()}`);
    sideANoConflict = await insertTestSideAccount(playerANoConflict, `ConflictSideA${uniqueSuffix()}`);

    playerBLow = await insertTestPlayer(bingo.id, `ConflictMainB${uniqueSuffix()}`);
    sideBLow = await insertTestSideAccount(playerBLow, `ConflictSideB${uniqueSuffix()}`);

    playerCHigh = await insertTestPlayer(bingo.id, `ConflictMainC${uniqueSuffix()}`);
    sideCHigh = await insertTestSideAccount(playerCHigh, `ConflictSideC${uniqueSuffix()}`);
  });

  test("no conflict when only the main account gains XP", async () => {
    // Main: 1,000 -> 5,000 XP over [t0, t1] (gaining).
    await pushPoint(playerANoConflict, undefined, 1_000, t0);
    await pushPoint(playerANoConflict, undefined, 5_000, t1);
    // Side: flat at 200 XP over the same window (no gain).
    await pushPoint(playerANoConflict, sideANoConflict, 200, t0);
    await pushPoint(playerANoConflict, sideANoConflict, 200, t1);

    const conflicts = await getBingoConflicts(bingo.id);
    expect(conflicts.find((c) => c.playerId === playerANoConflict)).toBeUndefined();
  });

  test("low severity: exactly one overlapping XP-gaining window", async () => {
    // Main: 1,000 -> 5,000 XP over [t0, t1] (gaining, +4,000).
    await pushPoint(playerBLow, undefined, 1_000, t0);
    await pushPoint(playerBLow, undefined, 5_000, t1);
    // Side: 200 -> 800 XP over the same [t0, t1] window (gaining, +600).
    await pushPoint(playerBLow, sideBLow, 200, t0);
    await pushPoint(playerBLow, sideBLow, 800, t1);

    const conflicts = await getBingoConflicts(bingo.id);
    const entry = conflicts.find((c) => c.playerId === playerBLow);

    expect(entry).toBeDefined();
    expect(entry!.severity).toBe("low");
    expect(entry!.windows).toHaveLength(1);
    expect(entry!.windows[0].mainXpGained).toBe(4_000);
    expect(entry!.windows[0].sideXpGained).toBe(600);
    expect(new Date(entry!.windows[0].start).getTime()).toBe(t0.getTime());
    expect(new Date(entry!.windows[0].end).getTime()).toBe(t1.getTime());
  });

  test("high severity: the same pair overlaps in more than one window", async () => {
    // Main: two separate gaining windows, [t0,t1] and [t2,t3], with a flat
    // stretch [t1,t2] in between (must NOT be counted as a third window).
    await pushPoint(playerCHigh, undefined, 1_000, t0);
    await pushPoint(playerCHigh, undefined, 5_000, t1); // +4,000 over [t0,t1]
    await pushPoint(playerCHigh, undefined, 5_000, t2); // flat over [t1,t2] -> dropped
    await pushPoint(playerCHigh, undefined, 9_000, t3); // +4,000 over [t2,t3]

    // Side: mirrors the same two gaining windows.
    await pushPoint(playerCHigh, sideCHigh, 200, t0);
    await pushPoint(playerCHigh, sideCHigh, 800, t1); // +600 over [t0,t1]
    await pushPoint(playerCHigh, sideCHigh, 800, t2); // flat over [t1,t2] -> dropped
    await pushPoint(playerCHigh, sideCHigh, 1_400, t3); // +600 over [t2,t3]

    const conflicts = await getBingoConflicts(bingo.id);
    const entry = conflicts.find((c) => c.playerId === playerCHigh);

    expect(entry).toBeDefined();
    expect(entry!.severity).toBe("high");
    expect(entry!.windows).toHaveLength(2);
    for (const w of entry!.windows) {
      expect(w.mainXpGained).toBe(4_000);
      expect(w.sideXpGained).toBe(600);
    }
  });

  test("response includes rsn and sideRsn for reporting", async () => {
    const conflicts = await getBingoConflicts(bingo.id);
    const entry = conflicts.find((c) => c.playerId === playerBLow);
    expect(entry).toBeDefined();
    expect(entry!.rsn.startsWith("ConflictMainB")).toBe(true);
    expect(entry!.sideRsn.startsWith("ConflictSideB")).toBe(true);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
