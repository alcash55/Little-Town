/**
 * Direct RPC-level coverage for upsert_player_hiscore_start /
 * upsert_player_hiscore_current (20260709000000_snapshot_upsert_rpc.sql).
 *
 * player-snapshots.test.ts already covers savePlayerSnapshot()'s observable
 * behavior end-to-end; this file additionally exercises the RPCs directly
 * (bypassing players.ts) so the ON CONFLICT arbiter selection itself — the
 * actual fix in that migration — is under test, including the
 * side-account path players.ts never calls this sprint (see
 * TEAM-BRIEF.md contract 7 and the savePlayerSnapshot doc comment in
 * src/db/players.ts).
 *
 * Skips cleanly (does not fail) if the local stack is unreachable, or if
 * the RPCs haven't been applied yet — see NOTE in TEAM-BRIEF.md: schema-
 * dependent tests must skip until the lead applies migrations at
 * integration.
 */
import { describe, test, expect, afterAll } from "bun:test";

import { getDb } from "../../src/db/client.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[players-snapshot-rpc.test.ts] skipping: ${stack.reason}`);
}

/**
 * Probe for the RPC's existence without touching any real data: call it
 * with a nil player_id. If the function exists, Postgres gets past
 * PostgREST's schema-cache lookup and fails on the bingo_player_hiscores_
 * player_id_fkey foreign key (23503) instead — the INSERT never commits.
 * If the function is missing, PostgREST responds with PGRST202 (schema
 * cache) or the function is undefined (42883, direct-to-Postgres callers).
 */
async function probeRpcAvailable(): Promise<boolean> {
  const { error } = await getDb().rpc("upsert_player_hiscore_start", {
    p_player_id: "00000000-0000-0000-0000-000000000000",
    p_side_account_id: null,
    p_skills: [],
    p_activities: [],
    p_taken_at: new Date().toISOString(),
  });
  if (!error) return true; // shouldn't happen (FK should reject), but "ran" implies it exists
  return error.code !== "PGRST202" && error.code !== "42883";
}

const rpcAvailable = stack.reachable ? await probeRpcAvailable() : false;
if (stack.reachable && !rpcAvailable) {
  console.warn(
    "[players-snapshot-rpc.test.ts] skipping: upsert_player_hiscore_start/current RPCs not found " +
      "(migrations not yet applied to this stack)",
  );
}

const createdBingoIds: string[] = [];

interface HiscoreRow {
  id: string;
  player_id: string;
  side_account_id: string | null;
  type: "start" | "current";
  skills: unknown;
  activities: unknown;
  taken_at: string;
}

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

function skillsPayload(rank: number) {
  return [{ id: 0, name: "Overall", rank, level: rank, xp: rank * 1000 }];
}

describe.skipIf(!stack.reachable || !rpcAvailable)("snapshot upsert RPC semantics", () => {
  let bingo: BingoRow;
  let playerId: string;
  let sideAccountId: string;

  test("fixtures: bingo, player, side account", async () => {
    bingo = await insertTestBingo(`test-snapshot-rpc-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    playerId = await insertTestPlayer(bingo.id, `RpcSnapshotPlayer${uniqueSuffix()}`);
    sideAccountId = await insertTestSideAccount(playerId, `RpcSideAcct${uniqueSuffix()}`);
  });

  test("upsert_player_hiscore_start is idempotent: re-running it keeps the first row's data", async () => {
    const first = await getDb().rpc("upsert_player_hiscore_start", {
      p_player_id: playerId,
      p_side_account_id: null,
      p_skills: skillsPayload(1),
      p_activities: [],
      p_taken_at: new Date().toISOString(),
    });
    expect(first.error).toBeNull();
    const firstRow = first.data as HiscoreRow;
    expect(firstRow.skills).toEqual(skillsPayload(1));

    const second = await getDb().rpc("upsert_player_hiscore_start", {
      p_player_id: playerId,
      p_side_account_id: null,
      p_skills: skillsPayload(999),
      p_activities: [],
      p_taken_at: new Date().toISOString(),
    });
    expect(second.error).toBeNull();
    const secondRow = second.data as HiscoreRow;

    // Same row, original data untouched — the re-run's payload is ignored.
    expect(secondRow.id).toBe(firstRow.id);
    expect(secondRow.skills).toEqual(skillsPayload(1));
    expect(secondRow.skills).not.toEqual(skillsPayload(999));
  });

  test("a side-account 'start' row coexists with the primary player's 'start' row", async () => {
    const sideResult = await getDb().rpc("upsert_player_hiscore_start", {
      p_player_id: playerId,
      p_side_account_id: sideAccountId,
      p_skills: skillsPayload(50),
      p_activities: [],
      p_taken_at: new Date().toISOString(),
    });
    expect(sideResult.error).toBeNull();
    const sideRow = sideResult.data as HiscoreRow;
    expect(sideRow.side_account_id).toBe(sideAccountId);
    expect(sideRow.player_id).toBe(playerId);
    expect(sideRow.skills).toEqual(skillsPayload(50));

    // Both the primary (side_account_id NULL) and side-account rows exist
    // simultaneously for the same player_id + type — this is exactly what
    // the stale bingo_player_snapshots_player_id_type_key constraint used
    // to forbid.
    const { data: rows, error } = await getDb()
      .from("bingo_player_hiscores")
      .select("*")
      .eq("player_id", playerId)
      .eq("type", "start");
    expect(error).toBeNull();
    const typed = (rows ?? []) as HiscoreRow[];
    expect(typed).toHaveLength(2);
    expect(typed.some((r) => r.side_account_id === null)).toBe(true);
    expect(typed.some((r) => r.side_account_id === sideAccountId)).toBe(true);
  });

  test("upsert_player_hiscore_current overwrites in place for both primary and side-account rows", async () => {
    const primaryFirst = await getDb().rpc("upsert_player_hiscore_current", {
      p_player_id: playerId,
      p_side_account_id: null,
      p_skills: skillsPayload(10),
      p_activities: [],
      p_taken_at: new Date().toISOString(),
    });
    expect(primaryFirst.error).toBeNull();
    const primaryFirstRow = primaryFirst.data as HiscoreRow;

    const primarySecond = await getDb().rpc("upsert_player_hiscore_current", {
      p_player_id: playerId,
      p_side_account_id: null,
      p_skills: skillsPayload(20),
      p_activities: [],
      p_taken_at: new Date().toISOString(),
    });
    expect(primarySecond.error).toBeNull();
    const primarySecondRow = primarySecond.data as HiscoreRow;

    // Same row (upsert, not a new insert), data replaced with the latest call.
    expect(primarySecondRow.id).toBe(primaryFirstRow.id);
    expect(primarySecondRow.skills).toEqual(skillsPayload(20));

    const sideFirst = await getDb().rpc("upsert_player_hiscore_current", {
      p_player_id: playerId,
      p_side_account_id: sideAccountId,
      p_skills: skillsPayload(30),
      p_activities: [],
      p_taken_at: new Date().toISOString(),
    });
    expect(sideFirst.error).toBeNull();
    const sideFirstRow = sideFirst.data as HiscoreRow;
    expect(sideFirstRow.side_account_id).toBe(sideAccountId);

    const sideSecond = await getDb().rpc("upsert_player_hiscore_current", {
      p_player_id: playerId,
      p_side_account_id: sideAccountId,
      p_skills: skillsPayload(40),
      p_activities: [],
      p_taken_at: new Date().toISOString(),
    });
    expect(sideSecond.error).toBeNull();
    const sideSecondRow = sideSecond.data as HiscoreRow;

    // Side-account "current" upserts independently of the primary row —
    // same id as its own first call, unrelated to the primary row's id.
    expect(sideSecondRow.id).toBe(sideFirstRow.id);
    expect(sideSecondRow.id).not.toBe(primarySecondRow.id);
    expect(sideSecondRow.skills).toEqual(skillsPayload(40));

    // Exactly one 'current' row each for primary and side account — no
    // duplicate rows accumulated across the two upserts per target.
    const { data: rows, error } = await getDb()
      .from("bingo_player_hiscores")
      .select("*")
      .eq("player_id", playerId)
      .eq("type", "current");
    expect(error).toBeNull();
    const typed = (rows ?? []) as HiscoreRow[];
    expect(typed).toHaveLength(2);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
