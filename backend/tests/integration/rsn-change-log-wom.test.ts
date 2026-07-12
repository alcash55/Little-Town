/**
 * Automatic RSN-rename resolution via Wise Old Man (Sprint 6 follow-up to
 * rsn-change-log.test.ts / 20260712000000_rsn_change_log_wom.sql).
 *
 * Exercises the real rsn_change_log / bingo_players /
 * bingo_player_side_accounts tables on the local Supabase stack.
 * services/hiscores.ts (the OSRS network call) and globalThis.fetch (the
 * Wise Old Man /names call) are both mocked — no real network involved.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { registerBingoPlayer, addSideAccount, type BingoPlayer } from "../../src/db/players.js";
import type { HiscoreData } from "../../src/types/index.js";
import {
  getLocalStackConfig,
  columnExists,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  countHiscoreRows,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[rsn-change-log-wom.test.ts] skipping: ${stack.reason}`);
}
const hasNewRsnColumn = stack.reachable ? await columnExists("rsn_change_log", "new_rsn") : false;
if (stack.reachable && !hasNewRsnColumn) {
  console.warn(
    "[rsn-change-log-wom.test.ts] skipping: rsn_change_log.new_rsn not present " +
      "(20260712000000_rsn_change_log_wom.sql not applied yet)",
  );
}
// A couple of tests below need an *active* bingo (refreshAllPlayerSnapshots
// only refreshes players on the active one) — same guard as
// side-account-snapshots.test.ts against uq_bingos_one_active on the shared
// local stack.
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[rsn-change-log-wom.test.ts] skipping: another bingo is already active in the shared local stack",
  );
}
const suite = stack.reachable && hasNewRsnColumn && !preexistingActive;
const hasPlayerIdColumn = stack.reachable ? await columnExists("bingo_submissions", "player_id") : false;

// -------------------------------------------------------
// Mock services/hiscores.ts — RSNs in `unresolvableRsns` 404; everything
// else resolves.
// -------------------------------------------------------

function fakeHiscoreData(name: string): HiscoreData {
  return {
    name,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 1000 }],
    activities: [],
    updatedAt: new Date(),
  };
}

const unresolvableRsns = new Set<string>();

const hiscoresMock = mock(async (rsn: string): Promise<HiscoreData | null> => {
  if (unresolvableRsns.has(rsn)) return null;
  return fakeHiscoreData(rsn);
});

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// -------------------------------------------------------
// Mock the Wise Old Man API via globalThis.fetch. `womChangesByUsername` is
// keyed by lowercase username — each test wires up whatever chain (or lack
// thereof) it needs before calling into the code under test.
// -------------------------------------------------------

interface WomChange {
  oldName: string;
  newName: string;
  status: string;
  resolvedAt: string | null;
  createdAt: string;
}

const womChangesByUsername = new Map<string, WomChange[]>();
const originalFetch = globalThis.fetch;
let womFetchMock: ReturnType<typeof mock>;

function approvedChange(oldName: string, newName: string, createdAt: string): WomChange {
  return { oldName, newName, status: "approved", resolvedAt: createdAt, createdAt };
}

function stubWomFetch(): void {
  womFetchMock = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (!url.includes("api.wiseoldman.net/v2/names")) {
      // Everything else (the local Supabase REST API, hit by getDb() via
      // supabase-js's own global-fetch use) passes through untouched — only
      // the Wise Old Man call is actually mocked here.
      return originalFetch(input, init);
    }
    const username = new URL(url).searchParams.get("username") ?? "";
    const body = womChangesByUsername.get(username.toLowerCase()) ?? [];
    return Promise.resolve(
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
    );
  });
  globalThis.fetch = womFetchMock as unknown as typeof fetch;
}

/**
 * Number of calls womFetchMock actually forwarded to the WOM endpoint —
 * womFetchMock also sees (and passes through) every local-Supabase REST
 * call made by db/*.ts helpers in the same test, so a plain
 * `toHaveBeenCalledTimes` would overcount.
 */
function womCallCount(): number {
  return womFetchMock.mock.calls.filter(([input]: [RequestInfo | URL]) => {
    const url = typeof input === "string" ? input : input.toString();
    return url.includes("api.wiseoldman.net/v2/names");
  }).length;
}

// Imported dynamically *after* the hiscores mock above is registered.
const {
  checkRsnChange,
  checkSideAccountRsnChange,
  _resetRsnChangeWomThrottleForTests,
} = await import("../../src/services/rsnChangeDetection.js");
const { refreshAllPlayerSnapshots } = await import("../../src/services/playerSnapshotCron.js");

async function unresolvedRow(
  column: "player_id" | "side_account_id",
  id: string,
): Promise<{
  id: string;
  resolved_at: string | null;
  new_rsn: string | null;
  resolution: string | null;
} | null> {
  const { data, error } = await getDb()
    .from("rsn_change_log")
    .select("id, resolved_at, new_rsn, resolution")
    .eq(column, id)
    .is("resolved_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; resolved_at: string | null; new_rsn: string | null; resolution: string | null } | null;
}

async function allRows(
  column: "player_id" | "side_account_id",
  id: string,
): Promise<Array<{ resolved_at: string | null; new_rsn: string | null; resolution: string | null }>> {
  const { data, error } = await getDb()
    .from("rsn_change_log")
    .select("resolved_at, new_rsn, resolution")
    .eq(column, id);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ resolved_at: string | null; new_rsn: string | null; resolution: string | null }>;
}

async function playerRsn(playerId: string): Promise<string> {
  const { data, error } = await getDb().from("bingo_players").select("rsn").eq("id", playerId).single();
  if (error || !data) throw new Error(error?.message ?? "player not found");
  return (data as { rsn: string }).rsn;
}

async function sideAccountRsn(sideAccountId: string): Promise<string> {
  const { data, error } = await getDb()
    .from("bingo_player_side_accounts")
    .select("rsn")
    .eq("id", sideAccountId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "side account not found");
  return (data as { rsn: string }).rsn;
}

const createdBingoIds: string[] = [];

beforeEach(() => {
  hiscoresMock.mockClear();
  unresolvableRsns.clear();
  womChangesByUsername.clear();
  stubWomFetch();
  _resetRsnChangeWomThrottleForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe.skipIf(!suite)("checkRsnChange — Wise Old Man auto-rename (main accounts)", () => {
  let bingo: BingoRow;
  let player: BingoPlayer;
  let oldRsn: string;

  test("fixtures: bingo with one player", async () => {
    bingo = await insertTestBingo(`test-rsn-wom-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    oldRsn = `WomOld${uniqueSuffix()}`;
    player = await registerBingoPlayer(bingo.id, oldRsn);
  });

  test("an approved WOM rename that resolves on hiscores updates rsn, resolves the row, and hands back hiscore data", async () => {
    const newRsn = `WomNew${uniqueSuffix()}`;
    womChangesByUsername.set(
      oldRsn.toLowerCase(),
      [approvedChange(oldRsn, newRsn, new Date().toISOString())],
    );

    const result = await checkRsnChange({ id: player.id, rsn: oldRsn }, false, "cron");

    expect(result.renamed).toBe(true);
    expect(result.newRsn).toBe(newRsn);
    expect(result.hiscoreData?.name).toBe(newRsn);

    expect(await playerRsn(player.id)).toBe(newRsn);

    const row = await unresolvedRow("player_id", player.id);
    expect(row).toBeNull(); // no longer unresolved

    const rows = await allRows("player_id", player.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].resolved_at).not.toBeNull();
    expect(rows[0].new_rsn).toBe(newRsn);
    expect(rows[0].resolution).toBe("auto_wom");
  });

  test("a cron tick for the (now-stale) old RSN resumes stats under the new name immediately", async () => {
    // Fresh bingo/player so this test is independent of rename state above.
    const cronBingo = await insertTestBingo(`test-rsn-wom-cron-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(cronBingo.id);
    const cronOldRsn = `WomCronOld${uniqueSuffix()}`;
    const cronNewRsn = `WomCronNew${uniqueSuffix()}`;
    const cronPlayer = await registerBingoPlayer(cronBingo.id, cronOldRsn);

    unresolvableRsns.add(cronOldRsn); // the old name 404s on this tick
    womChangesByUsername.set(
      cronOldRsn.toLowerCase(),
      [approvedChange(cronOldRsn, cronNewRsn, new Date().toISOString())],
    );

    const { succeeded, failed } = await refreshAllPlayerSnapshots();

    expect(failed).toHaveLength(0);
    expect(succeeded).toBe(1);
    expect(await playerRsn(cronPlayer.id)).toBe(cronNewRsn);
    // The snapshot was written THIS tick, under the new name's hiscore data
    // — not skipped/deferred to a future tick.
    expect(await countHiscoreRows(cronPlayer.id, "current")).toBe(1);

    // Deactivate immediately — only one bingo may be active at a time
    // (uq_bingos_one_active) and another test below also needs one active.
    await deleteTestBingo(cronBingo.id);
  });

  test("chained renames (A -> B -> C) are followed to the final approved name", async () => {
    const chainBingo = await insertTestBingo(`test-rsn-wom-chain-${uniqueSuffix()}`);
    createdBingoIds.push(chainBingo.id);
    const a = `WomChainA${uniqueSuffix()}`;
    const b = `WomChainB${uniqueSuffix()}`;
    const c = `WomChainC${uniqueSuffix()}`;
    const chainPlayer = await registerBingoPlayer(chainBingo.id, a);

    womChangesByUsername.set(a.toLowerCase(), [approvedChange(a, b, "2026-01-01T00:00:00Z")]);
    womChangesByUsername.set(b.toLowerCase(), [approvedChange(b, c, "2026-02-01T00:00:00Z")]);
    // c has no further approved changes -> chain stops there.

    const result = await checkRsnChange({ id: chainPlayer.id, rsn: a }, false, "cron");

    expect(result.renamed).toBe(true);
    expect(result.newRsn).toBe(c);
    expect(await playerRsn(chainPlayer.id)).toBe(c);
    // Only the final name needs to resolve on hiscores — b was never queried.
    expect(hiscoresMock).toHaveBeenCalledWith(c);
  });

  test("real prod case: two-hop chain with an unranked middle name (Tzhaar Chud -> CatgirlAlly -> DogGirlAlly)", async () => {
    const prodBingo = await insertTestBingo(`test-rsn-wom-prod-${uniqueSuffix()}`);
    createdBingoIds.push(prodBingo.id);
    const oldRsn = "Tzhaar Chud";
    const middleRsn = "CatgirlAlly"; // approved rename target, but unranked/banned — never resolves
    const finalRsn = "DogGirlAlly";
    const prodPlayer = await registerBingoPlayer(prodBingo.id, oldRsn);

    unresolvableRsns.add(middleRsn); // 404s on hiscores if ever checked directly
    womChangesByUsername.set(oldRsn.toLowerCase(), [
      approvedChange(oldRsn, middleRsn, "2026-06-21T00:00:00Z"),
    ]);
    womChangesByUsername.set(middleRsn.toLowerCase(), [
      approvedChange(middleRsn, finalRsn, "2026-07-09T00:00:00Z"),
    ]);
    // finalRsn has no further approved changes -> chain stops there, and it
    // resolves fine on hiscores (fakeHiscoreData default).

    const result = await checkRsnChange({ id: prodPlayer.id, rsn: oldRsn }, false, "cron");

    expect(result.renamed).toBe(true);
    expect(result.newRsn).toBe(finalRsn);
    expect(await playerRsn(prodPlayer.id)).toBe(finalRsn);
    // The middle (unranked) name is never trusted on its own — only the
    // final name's hiscore resolution is what confirms the rename.
    expect(hiscoresMock).not.toHaveBeenCalledWith(middleRsn);
    expect(hiscoresMock).toHaveBeenCalledWith(finalRsn);
  });

  test("cycle guard: an older, unrelated 'oldName' match for a reused RSN string is not mistaken for the current chain", async () => {
    const cycleBingo = await insertTestBingo(`test-rsn-wom-cycle-${uniqueSuffix()}`);
    createdBingoIds.push(cycleBingo.id);
    const oldRsn = "Tzhaar Chud";
    const newRsn = "CatgirlAlly";
    const cyclePlayer = await registerBingoPlayer(cycleBingo.id, oldRsn);

    // "Tzhaar Chud" was previously reached by a DIFFERENT, unrelated chain
    // ("Catgirl Ally" -> "Tzhaar Chud", years earlier) before being freed
    // and picked up by the account we're actually tracking. Both records
    // come back from the same /names?username=Tzhaar%20Chud query — only
    // the oldName === "Tzhaar Chud" one is even eligible, so this mostly
    // exercises that the older/irrelevant record can't leak in.
    womChangesByUsername.set(oldRsn.toLowerCase(), [
      approvedChange("Catgirl Ally", oldRsn, "2020-01-01T00:00:00Z"), // oldName mismatch — must be ignored
      approvedChange(oldRsn, newRsn, "2026-06-21T00:00:00Z"),
    ]);

    const result = await checkRsnChange({ id: cyclePlayer.id, rsn: oldRsn }, false, "cron");

    expect(result.renamed).toBe(true);
    expect(result.newRsn).toBe(newRsn);
    expect(await playerRsn(cyclePlayer.id)).toBe(newRsn);
  });

  test("WOM has no approved match: row stays unresolved, rsn unchanged, player skipped by the cron", async () => {
    const noMatchBingo = await insertTestBingo(`test-rsn-wom-none-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(noMatchBingo.id);
    const rsn = `WomNoneRsn${uniqueSuffix()}`;
    const noMatchPlayer = await registerBingoPlayer(noMatchBingo.id, rsn);
    unresolvableRsns.add(rsn);
    // womChangesByUsername has nothing for this rsn — WOM 200s with [].

    const { succeeded, failed } = await refreshAllPlayerSnapshots();

    expect(succeeded).toBe(0);
    expect(failed).toHaveLength(1);
    expect(await playerRsn(noMatchPlayer.id)).toBe(rsn);

    const row = await unresolvedRow("player_id", noMatchPlayer.id);
    expect(row).not.toBeNull();
    expect(row!.new_rsn).toBeNull();
    expect(row!.resolution).toBeNull();
  });

  test("WOM reports a rename but the candidate name doesn't resolve on hiscores: no update, stays unresolved", async () => {
    const badBingo = await insertTestBingo(`test-rsn-wom-bad-${uniqueSuffix()}`);
    createdBingoIds.push(badBingo.id);
    const rsn = `WomBadOld${uniqueSuffix()}`;
    const badNewRsn = `WomBadNew${uniqueSuffix()}`;
    const badPlayer = await registerBingoPlayer(badBingo.id, rsn);

    womChangesByUsername.set(rsn.toLowerCase(), [approvedChange(rsn, badNewRsn, new Date().toISOString())]);
    unresolvableRsns.add(badNewRsn); // WOM says renamed, but the new name is banned/unranked

    const result = await checkRsnChange({ id: badPlayer.id, rsn }, false, "cron");

    expect(result.renamed).toBe(false);
    expect(await playerRsn(badPlayer.id)).toBe(rsn); // unchanged

    const row = await unresolvedRow("player_id", badPlayer.id);
    expect(row).not.toBeNull();
    expect(row!.new_rsn).toBeNull();
    expect(row!.resolution).toBeNull();
  });

  test("throttle: a second check within the hour for a still-stale player does not re-hit WOM", async () => {
    const throttleBingo = await insertTestBingo(`test-rsn-wom-throttle-${uniqueSuffix()}`);
    createdBingoIds.push(throttleBingo.id);
    const rsn = `WomThrottleRsn${uniqueSuffix()}`;
    const throttlePlayer = await registerBingoPlayer(throttleBingo.id, rsn);
    // No WOM data at all for this rsn — every attempt would be a miss.

    await checkRsnChange({ id: throttlePlayer.id, rsn }, false, "cron");
    expect(womCallCount()).toBe(1);

    // A second tick immediately after (well within the 1-hour throttle
    // window) must not hit WOM again.
    await checkRsnChange({ id: throttlePlayer.id, rsn }, false, "cron");
    expect(womCallCount()).toBe(1);

    // Still exactly one unresolved row — the throttled call reused it.
    expect(await allRows("player_id", throttlePlayer.id)).toHaveLength(1);
  });
});

describe.skipIf(!suite)("checkSideAccountRsnChange — Wise Old Man auto-rename (side accounts)", () => {
  let bingo: BingoRow;
  let player: BingoPlayer;
  let sideAccountId: string;
  let oldRsn: string;

  test("fixtures: bingo with one player and one side account", async () => {
    bingo = await insertTestBingo(`test-side-rsn-wom-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    player = await registerBingoPlayer(bingo.id, `SideWomMain${uniqueSuffix()}`);
    oldRsn = `SideWomOld${uniqueSuffix()}`;
    const side = await addSideAccount(player.id, oldRsn);
    sideAccountId = side.id;
  });

  test("an approved WOM rename updates the side account's rsn and resolves the row with side_account_id set", async () => {
    const newRsn = `SideWomNew${uniqueSuffix()}`;
    womChangesByUsername.set(oldRsn.toLowerCase(), [approvedChange(oldRsn, newRsn, new Date().toISOString())]);

    const result = await checkSideAccountRsnChange({ id: sideAccountId, rsn: oldRsn }, false, "cron");

    expect(result.renamed).toBe(true);
    expect(result.newRsn).toBe(newRsn);
    expect(await sideAccountRsn(sideAccountId)).toBe(newRsn);

    const row = await unresolvedRow("side_account_id", sideAccountId);
    expect(row).toBeNull();

    const { data: fullRow, error } = await getDb()
      .from("rsn_change_log")
      .select("player_id, side_account_id, new_rsn, resolution")
      .eq("side_account_id", sideAccountId)
      .single();
    if (error) throw new Error(error.message);
    expect((fullRow as { player_id: string | null }).player_id).toBeNull();
    expect((fullRow as { new_rsn: string }).new_rsn).toBe(newRsn);
    expect((fullRow as { resolution: string }).resolution).toBe("auto_wom");
  });

  test("a side account's rsn_change_log row never counts toward the parent player's rsnStale flag", async () => {
    const { getUnresolvedRsnChangesByPlayer } = await import("../../src/db/rsnChangeLog.js");
    // Force a fresh unresolved side-account row (independent of the resolved one above).
    const staleSideRsn = `SideWomStale${uniqueSuffix()}`;
    const staleSide = await addSideAccount(player.id, staleSideRsn);
    await checkSideAccountRsnChange({ id: staleSide.id, rsn: staleSideRsn }, false, "cron");

    const map = await getUnresolvedRsnChangesByPlayer([player.id]);
    expect(map.has(player.id)).toBe(false);
  });
});

describe.skipIf(!(suite && hasPlayerIdColumn))(
  "getPlayerStats' rsnStale clears naturally after an auto-rename (verifies it still keys off unresolved rows)",
  () => {
    test("rsnStale flips from true to false once WOM auto-resolves the rename", async () => {
      const { getPlayerStats } = await import("../../src/db/playerStats.js");

      const statsBingo = await insertTestBingo(`test-rsn-wom-stats-${uniqueSuffix()}`);
      createdBingoIds.push(statsBingo.id);
      const oldRsn = `WomStatsOld${uniqueSuffix()}`;
      const newRsn = `WomStatsNew${uniqueSuffix()}`;
      const statsPlayer = await registerBingoPlayer(statsBingo.id, oldRsn);

      // Log it stale first, same as a 404'd tick with no WOM match yet.
      await checkRsnChange({ id: statsPlayer.id, rsn: oldRsn }, false, "cron");

      const beforeStats = await getPlayerStats(statsBingo.id);
      const before = beforeStats.find((s) => s.rsn === oldRsn);
      expect(before?.rsnStale).toBe(true);
      expect(before?.rsnStaleSince).not.toBeNull();

      // Now WOM has an approved rename and the new name resolves.
      womChangesByUsername.set(oldRsn.toLowerCase(), [approvedChange(oldRsn, newRsn, new Date().toISOString())]);
      _resetRsnChangeWomThrottleForTests(); // this player was already throttled by the call above
      const result = await checkRsnChange({ id: statsPlayer.id, rsn: oldRsn }, false, "cron");
      expect(result.renamed).toBe(true);

      const afterStats = await getPlayerStats(statsBingo.id);
      const after = afterStats.find((s) => s.rsn === newRsn);
      expect(after).toBeDefined();
      expect(after?.rsnStale).toBe(false);
      expect(after?.rsnStaleSince).toBeNull();
    });
  },
);

describe.skipIf(!suite)("rsn_change_log_target_xor constraint (20260712000000_rsn_change_log_wom.sql)", () => {
  test("a row with neither player_id nor side_account_id set is rejected", async () => {
    const { error } = await getDb()
      .from("rsn_change_log")
      .insert({ old_rsn: "Nobody", source: "cron" });
    expect(error).not.toBeNull();
  });

  test("a row with both player_id and side_account_id set is rejected", async () => {
    const bingo = await insertTestBingo(`test-rsn-xor-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    const player = await registerBingoPlayer(bingo.id, `XorPlayer${uniqueSuffix()}`);
    const side = await addSideAccount(player.id, `XorSide${uniqueSuffix()}`);

    const { error } = await getDb()
      .from("rsn_change_log")
      .insert({ player_id: player.id, side_account_id: side.id, old_rsn: "Both", source: "cron" });
    expect(error).not.toBeNull();
  });
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
