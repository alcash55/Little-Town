/**
 * #49: side-account counterpart of activation-retakes-start.test.ts's D2
 * regression coverage. That file proves a PRIMARY account's pre-activation
 * 'start' snapshot gets replaced (not left alone) at activation time; this
 * file proves the same holds for a SIDE account, since side-account gains
 * feed the same team-total math (services/completionEngine.ts) and a stale
 * pre-bingo baseline would leak the same way.
 *
 * The fix already exists (services/sideAccountSnapshots.ts's
 * snapshotOneSideAccount takes a retakeExisting flag, threaded through from
 * bingoActivation.ts's takeActivationSnapshots) — this was a coverage gap,
 * not a live bug: nothing exercised it end to end.
 *
 * Runs against the real bingos/bingo_players/bingo_player_side_accounts/
 * bingo_player_hiscores tables on the local Supabase stack — only
 * services/hiscores.ts (the real OSRS network call) is mocked.
 */
import { describe, test, expect, afterAll, beforeEach, mock } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { registerBingoPlayer, addSideAccount, savePlayerSnapshot } from "../../src/db/players.js";
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
  console.warn(`[activation-retakes-start-side-account.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[activation-retakes-start-side-account.test.ts] skipping: another bingo is already active in the shared local stack",
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

const ACTIVATION_TIME_XP = 500_215;
const hiscoresMock = mock(async (): Promise<HiscoreData | null> => fakeHiscoreData(ACTIVATION_TIME_XP));

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* the mock above is registered.
const { activateBingoWithSnapshots } = await import("../../src/services/bingoActivation.js");

beforeEach(() => {
  hiscoresMock.mockClear();
});

const createdBingoIds: string[] = [];

/** Same shape as helpers.ts's countHiscoreRows, but for a side account rather than a primary. */
async function countSideHiscoreRows(sideAccountId: string, type: "start" | "current"): Promise<number> {
  const { count, error } = await getDb()
    .from("bingo_player_hiscores")
    .select("id", { count: "exact", head: true })
    .eq("side_account_id", sideAccountId)
    .eq("type", type);
  if (error) throw new Error(`Failed to count ${type} snapshots for side account ${sideAccountId}: ${error.message}`);
  return count ?? 0;
}

async function getSideStartXp(sideAccountId: string): Promise<number> {
  const { data, error } = await getDb()
    .from("bingo_player_hiscores")
    .select("skills")
    .eq("side_account_id", sideAccountId)
    .eq("type", "start")
    .single();
  if (error || !data) throw new Error(`Failed to fetch start snapshot for side account ${sideAccountId}: ${error?.message}`);
  return (data as { skills: Array<{ xp: number }> }).skills[0].xp;
}

describe.skipIf(!suite)("bingo activation rebaselines side-account start snapshots too (#49)", () => {
  let bingo: BingoRow;
  let playerId: string;
  let sideAccountId: string;
  const REGISTRATION_TIME_XP = 10_000;

  test("fixtures: draft bingo, one player with a side account that already has a pre-activation start snapshot", async () => {
    bingo = await insertTestBingo(`test-retake-start-side-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);

    const player = await registerBingoPlayer(bingo.id, `SideRebaselinePlayer${uniqueSuffix()}`);
    playerId = player.id;
    const sideAccount = await addSideAccount(playerId, `SideRebaselineAlt${uniqueSuffix()}`);
    sideAccountId = sideAccount.id;

    // Simulates a side account added (and given a best-effort snapshot, as
    // routes/admin.ts's POST .../side-accounts does) before this test's
    // activation call — days of pre-bingo gains sitting in it, same setup
    // as activation-retakes-start.test.ts's primary-account case.
    await savePlayerSnapshot(playerId, "start", fakeHiscoreData(REGISTRATION_TIME_XP), sideAccountId);
    await savePlayerSnapshot(playerId, "current", fakeHiscoreData(REGISTRATION_TIME_XP), sideAccountId);
    expect(await countSideHiscoreRows(sideAccountId, "start")).toBe(1);
    expect(await getSideStartXp(sideAccountId)).toBe(REGISTRATION_TIME_XP);

    // The PRIMARY account has no pre-existing snapshot yet — activation
    // takes its first snapshot in the same call, exercising primary +
    // side-account rebaseline together in one activation, not in isolation.
    expect(await countHiscoreRows(playerId, "start")).toBe(0);
  });

  test("activation replaces the side account's pre-existing start snapshot with a fresh activation-time baseline", async () => {
    const outcome = await activateBingoWithSnapshots(bingo.id, { source: "drafter" });

    expect(outcome.activated).toBe(true);
    expect(outcome.blocked).toBe(false);
    expect(outcome.succeeded).toBe(1); // primary account
    expect(outcome.sideResults).toHaveLength(1);
    expect(outcome.sideResults[0]).toMatchObject({ sideAccountId, ok: true });

    // Still exactly one start row for the side account — replaced in
    // place, not duplicated.
    expect(await countSideHiscoreRows(sideAccountId, "start")).toBe(1);

    const startXp = await getSideStartXp(sideAccountId);
    // The pre-bingo registration-time XP must be gone from the new
    // baseline — without retakeExisting threaded through to side accounts,
    // this assertion fails because the insert-if-absent RPC silently keeps
    // the old row (the same bug D2 fixed for primary accounts).
    expect(startXp).not.toBe(REGISTRATION_TIME_XP);
    expect(startXp).toBe(ACTIVATION_TIME_XP);
  });

  test("gains between registration and activation do not count for the side account either: start == current", async () => {
    const { data: startRow } = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("side_account_id", sideAccountId)
      .eq("type", "start")
      .single();
    const { data: currentRow } = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("side_account_id", sideAccountId)
      .eq("type", "current")
      .single();

    const startXp = (startRow as { skills: Array<{ xp: number }> }).skills[0].xp;
    const currentXp = (currentRow as { skills: Array<{ xp: number }> }).skills[0].xp;
    expect(currentXp - startXp).toBe(0);
  });

  test("the primary account's own start snapshot was rebaselined in the same activation call, unaffected by the side account's history", async () => {
    expect(await countHiscoreRows(playerId, "start")).toBe(1);
    const { data } = await getDb()
      .from("bingo_player_hiscores")
      .select("skills")
      .eq("player_id", playerId)
      .eq("type", "start")
      .is("side_account_id", null)
      .single();
    expect((data as { skills: Array<{ xp: number }> }).skills[0].xp).toBe(ACTIVATION_TIME_XP);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
