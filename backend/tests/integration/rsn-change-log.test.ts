/**
 * RSN change detection (TEAM-BRIEF.md Sprint 5, Track A item 1).
 *
 * Exercises the real rsn_change_log table + db/rsnChangeLog.ts against the
 * local Supabase stack, and services/rsnChangeDetection.ts's checkRsnChange
 * wrapper on top of it — no network involved, since these all take a
 * pre-computed "did the hiscore lookup find the player" boolean rather than
 * calling the real OSRS API themselves.
 */
import { describe, test, expect, afterAll } from "bun:test";

import {
  logRsnChange,
  resolveRsnChange,
  getUnresolvedRsnChangesByPlayer,
} from "../../src/db/rsnChangeLog.js";
import { checkRsnChange } from "../../src/services/rsnChangeDetection.js";
import { getPlayerStats } from "../../src/db/playerStats.js";
import { registerBingoPlayer } from "../../src/db/players.js";
import { getDb } from "../../src/db/client.js";
import {
  getLocalStackConfig,
  columnExists,
  insertTestBingo,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[rsn-change-log.test.ts] skipping: ${stack.reason}`);
}
const hasTable = stack.reachable ? await columnExists("rsn_change_log", "player_id") : false;
if (stack.reachable && !hasTable) {
  console.warn(
    "[rsn-change-log.test.ts] skipping: rsn_change_log table not present " +
      "(20260711143000_rsn_change_log.sql not applied yet)",
  );
}
const hasPlayerIdColumn = stack.reachable ? await columnExists("bingo_submissions", "player_id") : false;

const suite = stack.reachable && hasTable;
const createdBingoIds: string[] = [];

async function unresolvedRow(playerId: string): Promise<{ resolved_at: string | null } | null> {
  const { data, error } = await getDb()
    .from("rsn_change_log")
    .select("resolved_at")
    .eq("player_id", playerId)
    .is("resolved_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { resolved_at: string | null } | null;
}

async function allRowsForPlayer(playerId: string): Promise<unknown[]> {
  const { data, error } = await getDb().from("rsn_change_log").select("*").eq("player_id", playerId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

describe.skipIf(!suite)("db/rsnChangeLog.ts (logRsnChange / resolveRsnChange)", () => {
  let bingo: BingoRow;
  let playerId: string;
  const rsn = `RsnChangePlayer${uniqueSuffix()}`;

  test("fixtures: bingo with one player", async () => {
    bingo = await insertTestBingo(`test-rsn-change-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    const player = await registerBingoPlayer(bingo.id, rsn);
    playerId = player.id;
  });

  test("logRsnChange creates one unresolved row", async () => {
    await logRsnChange(playerId, rsn, "cron");
    const row = await unresolvedRow(playerId);
    expect(row).not.toBeNull();
    expect(row!.resolved_at).toBeNull();
    expect(await allRowsForPlayer(playerId)).toHaveLength(1);
  });

  test("logRsnChange again while still unresolved is a no-op — no duplicate row", async () => {
    await logRsnChange(playerId, rsn, "cron");
    await logRsnChange(playerId, rsn, "drafter");
    expect(await allRowsForPlayer(playerId)).toHaveLength(1);
  });

  test("resolveRsnChange marks the unresolved row resolved", async () => {
    await resolveRsnChange(playerId);
    const row = await unresolvedRow(playerId);
    expect(row).toBeNull();
    const all = (await allRowsForPlayer(playerId)) as Array<{ resolved_at: string | null }>;
    expect(all).toHaveLength(1);
    expect(all[0].resolved_at).not.toBeNull();
  });

  test("resolveRsnChange with nothing unresolved is a harmless no-op", async () => {
    await resolveRsnChange(playerId); // already resolved by the previous test
    const all = await allRowsForPlayer(playerId);
    expect(all).toHaveLength(1); // still just the one (now-resolved) row
  });

  test("a fresh RSN failure after resolution logs a NEW row (re-detection, not reuse)", async () => {
    await logRsnChange(playerId, rsn, "cron");
    const all = await allRowsForPlayer(playerId);
    expect(all).toHaveLength(2);
    const row = await unresolvedRow(playerId);
    expect(row).not.toBeNull();
  });

  test("getUnresolvedRsnChangesByPlayer reflects current unresolved state across players", async () => {
    const otherPlayer = await registerBingoPlayer(bingo.id, `RsnChangeOther${uniqueSuffix()}`);
    // otherPlayer has no rsn_change_log rows at all — must be absent from the map.
    const map = await getUnresolvedRsnChangesByPlayer([playerId, otherPlayer.id]);
    expect(map.has(playerId)).toBe(true);
    expect(map.has(otherPlayer.id)).toBe(false);
  });

  test("getUnresolvedRsnChangesByPlayer with an empty id list short-circuits to an empty map", async () => {
    const map = await getUnresolvedRsnChangesByPlayer([]);
    expect(map.size).toBe(0);
  });
});

describe.skipIf(!suite)("services/rsnChangeDetection.ts (checkRsnChange)", () => {
  let bingo: BingoRow;
  let playerId: string;
  let rsn: string;

  test("fixtures: bingo with one player", async () => {
    bingo = await insertTestBingo(`test-check-rsn-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    rsn = `CheckRsnPlayer${uniqueSuffix()}`;
    const player = await registerBingoPlayer(bingo.id, rsn);
    playerId = player.id;
  });

  test("hiscoreFound: false logs an unresolved entry with the given source", async () => {
    await checkRsnChange({ id: playerId, rsn }, false, "cron");
    const row = await unresolvedRow(playerId);
    expect(row).not.toBeNull();
  });

  test("hiscoreFound: false again (still stale) does not create a second row", async () => {
    await checkRsnChange({ id: playerId, rsn }, false, "drafter");
    expect(await allRowsForPlayer(playerId)).toHaveLength(1);
  });

  test("hiscoreFound: true resolves the outstanding entry", async () => {
    await checkRsnChange({ id: playerId, rsn }, true, "cron");
    const row = await unresolvedRow(playerId);
    expect(row).toBeNull();
  });

  test("hiscoreFound: true with nothing outstanding is a harmless no-op", async () => {
    await checkRsnChange({ id: playerId, rsn }, true, "cron");
    const all = await allRowsForPlayer(playerId);
    expect(all).toHaveLength(1); // the one row from earlier, still resolved
  });
});

describe.skipIf(!(suite && hasPlayerIdColumn))(
  "getPlayerStats surfaces rsnStale / rsnStaleSince (contract 3 extension)",
  () => {
    let bingo: BingoRow;
    let stalePlayerId: string;
    let staleRsn: string;
    let freshRsn: string;

    test("fixtures: bingo with a stale player and a healthy player", async () => {
      bingo = await insertTestBingo(`test-stats-rsn-stale-${uniqueSuffix()}`);
      createdBingoIds.push(bingo.id);
      staleRsn = `StalePlayer${uniqueSuffix()}`;
      freshRsn = `FreshRsnPlayer${uniqueSuffix()}`;
      const stalePlayer = await registerBingoPlayer(bingo.id, staleRsn);
      stalePlayerId = stalePlayer.id;
      await registerBingoPlayer(bingo.id, freshRsn);
      await logRsnChange(stalePlayerId, staleRsn, "cron");
    });

    test("stale player has rsnStale: true and a matching rsnStaleSince", async () => {
      const stats = await getPlayerStats(bingo.id);
      const stale = stats.find((s) => s.rsn === staleRsn);
      expect(stale).toBeDefined();
      expect(stale!.rsnStale).toBe(true);
      expect(stale!.rsnStaleSince).not.toBeNull();
      expect(Number.isNaN(Date.parse(stale!.rsnStaleSince!))).toBe(false);
    });

    test("healthy player has rsnStale: false and rsnStaleSince: null", async () => {
      const stats = await getPlayerStats(bingo.id);
      const fresh = stats.find((s) => s.rsn === freshRsn);
      expect(fresh).toBeDefined();
      expect(fresh!.rsnStale).toBe(false);
      expect(fresh!.rsnStaleSince).toBeNull();
    });

    test("resolving the log entry flips rsnStale back to false", async () => {
      await resolveRsnChange(stalePlayerId);
      const stats = await getPlayerStats(bingo.id);
      const stale = stats.find((s) => s.rsn === staleRsn);
      expect(stale!.rsnStale).toBe(false);
      expect(stale!.rsnStaleSince).toBeNull();
    });
  },
);

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
