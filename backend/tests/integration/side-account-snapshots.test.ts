/**
 * Side-account hiscore snapshot polling (Sprint 5 follow-up to Track A/B).
 *
 * Since Sprint 3, upsert_player_hiscore_start/current accepted a
 * p_side_account_id, but nothing ever called savePlayerSnapshot with one —
 * this wires it into the three flows that take/refresh snapshots (activation
 * start snapshots, the snapshot cron's current refresh, and — by sharing
 * bingoActivation.ts's snapshotStartAndCurrent — the retake-start-snapshots
 * admin route) via services/sideAccountSnapshots.ts.
 *
 * Runs against the real bingos/bingo_players/bingo_player_side_accounts/
 * bingo_player_hiscores/bingo_player_hiscore_history tables on the local
 * Supabase stack — only services/hiscores.ts (the real OSRS network call)
 * is mocked.
 */
import { describe, test, expect, afterAll, beforeEach, mock } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { registerBingoPlayer, addSideAccount, type BingoPlayer } from "../../src/db/players.js";
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
  console.warn(`[side-account-snapshots.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[side-account-snapshots.test.ts] skipping: another bingo is already active in the shared local stack",
  );
}
const suite = stack.reachable && !preexistingActive;

// -------------------------------------------------------
// Mock services/hiscores.ts — the only network-touching dependency.
// -------------------------------------------------------

function fakeHiscoreData(name: string): HiscoreData {
  return {
    name,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 1000 }],
    activities: [],
    updatedAt: new Date(),
  };
}

/** RSNs in this set 404 on the mocked hiscores lookup; everything else resolves. */
const unresolvableRsns = new Set<string>();

const hiscoresMock = mock(async (rsn: string): Promise<HiscoreData | null> => {
  if (unresolvableRsns.has(rsn)) return null;
  return fakeHiscoreData(rsn);
});

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* the mock above is registered.
const { snapshotStartAndCurrent } = await import("../../src/services/bingoActivation.js");
const { refreshAllPlayerSnapshots } = await import("../../src/services/playerSnapshotCron.js");

async function countSideHiscoreRows(sideAccountId: string, type: "start" | "current"): Promise<number> {
  const { count, error } = await getDb()
    .from("bingo_player_hiscores")
    .select("id", { count: "exact", head: true })
    .eq("side_account_id", sideAccountId)
    .eq("type", type);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countHistoryRows(sideAccountId: string): Promise<number> {
  const { count, error } = await getDb()
    .from("bingo_player_hiscore_history")
    .select("id", { count: "exact", head: true })
    .eq("side_account_id", sideAccountId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

beforeEach(() => {
  hiscoresMock.mockClear();
});

const createdBingoIds: string[] = [];

describe.skipIf(!suite)("snapshotStartAndCurrent — side accounts (activation / retake)", () => {
  let bingo: BingoRow;
  let player: BingoPlayer;
  let goodSideId: string;
  let goodSideRsn: string;
  let badSideId: string;
  let badSideRsn: string;

  test("fixtures: one player with a resolvable and an unresolvable side account", async () => {
    bingo = await insertTestBingo(`test-side-activation-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);

    const rsn = `SideActivationMain${uniqueSuffix()}`;
    player = await registerBingoPlayer(bingo.id, rsn);

    goodSideRsn = `SideActivationGood${uniqueSuffix()}`;
    badSideRsn = `SideActivationBad${uniqueSuffix()}`;
    unresolvableRsns.add(badSideRsn);

    const goodSide = await addSideAccount(player.id, goodSideRsn);
    const badSide = await addSideAccount(player.id, badSideRsn);
    goodSideId = goodSide.id;
    badSideId = badSide.id;
  });

  test("activation writes start+current snapshots for the resolvable side account", async () => {
    const { succeeded, failed, sideResults } = await snapshotStartAndCurrent([player], "drafter");

    // Main account unaffected by side-account outcomes either way.
    expect(succeeded).toBe(1);
    expect(failed).toHaveLength(0);
    expect(await countHiscoreRows(player.id, "start")).toBe(1);

    expect(sideResults).toHaveLength(2);
    const goodResult = sideResults.find((r) => r.sideAccountId === goodSideId)!;
    const badResult = sideResults.find((r) => r.sideAccountId === badSideId)!;

    expect(goodResult.ok).toBe(true);
    expect(badResult.ok).toBe(false);
    expect(badResult.error).toContain(badSideRsn);

    expect(await countSideHiscoreRows(goodSideId, "start")).toBe(1);
    expect(await countSideHiscoreRows(goodSideId, "current")).toBe(1);
    expect(await countSideHiscoreRows(badSideId, "start")).toBe(0);
    expect(await countSideHiscoreRows(badSideId, "current")).toBe(0);
  });

  test("a failed side lookup does not touch the parent player's own snapshot rows", async () => {
    // Re-run (as retake-start-snapshots would) — main account's start row
    // must stay exactly one row (idempotent), unaffected by the still-bad side account.
    await snapshotStartAndCurrent([player], "drafter");
    expect(await countHiscoreRows(player.id, "start")).toBe(1);
    expect(await countHiscoreRows(player.id, "current")).toBe(1);
  });

  test("the resolvable side account's writes feed bingo_player_hiscore_history (conflicts data source)", async () => {
    // Two snapshotStartAndCurrent calls above each wrote 'current' for the
    // good side account, and the DB trigger logs every insert/meaningful
    // update — at least the start row + N distinct current observations.
    const historyRows = await countHistoryRows(goodSideId);
    expect(historyRows).toBeGreaterThanOrEqual(2);
    // The bad side account never had a row written, so it never got logged.
    expect(await countHistoryRows(badSideId)).toBe(0);
  });

  test("fixing the bad side account's RSN and retaking succeeds without duplicating the good one's rows", async () => {
    unresolvableRsns.delete(badSideRsn);

    const { sideResults } = await snapshotStartAndCurrent([player], "drafter");
    const badResult = sideResults.find((r) => r.sideAccountId === badSideId)!;
    expect(badResult.ok).toBe(true);

    expect(await countSideHiscoreRows(badSideId, "start")).toBe(1);
    expect(await countSideHiscoreRows(badSideId, "current")).toBe(1);
    // Idempotent: the good side account's start row is still exactly one row.
    expect(await countSideHiscoreRows(goodSideId, "start")).toBe(1);
  });
});

describe.skipIf(!suite)("refreshAllPlayerSnapshots (cron) — side accounts", () => {
  let bingo: BingoRow;
  let player: BingoPlayer;
  let sideId: string;
  let sideRsn: string;

  test("fixtures: active bingo with a player and a resolvable side account", async () => {
    bingo = await insertTestBingo(`test-side-cron-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const rsn = `SideCronMain${uniqueSuffix()}`;
    player = await registerBingoPlayer(bingo.id, rsn);
    sideRsn = `SideCronSide${uniqueSuffix()}`;
    const side = await addSideAccount(player.id, sideRsn);
    sideId = side.id;

    // The cron only ever refreshes 'current' — a side account never gets a
    // 'start' snapshot from it (mirrors main-account cron behavior).
    expect(await countSideHiscoreRows(sideId, "start")).toBe(0);
  });

  test("a cron tick refreshes the side account's 'current' snapshot but never writes 'start'", async () => {
    const { succeeded, failed } = await refreshAllPlayerSnapshots();
    expect(succeeded).toBe(1);
    expect(failed).toHaveLength(0);

    expect(await countSideHiscoreRows(sideId, "current")).toBe(1);
    expect(await countSideHiscoreRows(sideId, "start")).toBe(0);
  });

  test("a failed side-account lookup on a cron tick does not fail the main player's refresh", async () => {
    unresolvableRsns.add(sideRsn);

    const { succeeded, failed } = await refreshAllPlayerSnapshots();
    expect(succeeded).toBe(1); // main account still refreshed
    expect(failed).toHaveLength(0);

    // Side account's 'current' row from the previous successful tick is
    // left as-is (upsert never ran) — not deleted, not corrupted.
    expect(await countSideHiscoreRows(sideId, "current")).toBe(1);

    unresolvableRsns.delete(sideRsn);
  });

  test("a second successful tick upserts the side account's 'current' row in place (no duplicate)", async () => {
    await refreshAllPlayerSnapshots();
    expect(await countSideHiscoreRows(sideId, "current")).toBe(1);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
