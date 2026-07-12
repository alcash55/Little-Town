/**
 * Team XP history aggregation (TEAM-BRIEF.md Sprint 6, Track A item 3) —
 * getTeamXpHistory() (src/db/teamXpHistory.ts), the GET
 * /api/bingo/team-xp-history endpoint's underlying query.
 *
 * Fixtures push history points directly via the upsert_player_hiscore_start/
 * current RPCs (same technique as tests/integration/bingo-conflicts.test.ts)
 * so each test controls exact taken_at timestamps and 'start' vs 'current'
 * typing without waiting on the real cron or the OSRS API.
 */
import { describe, test, expect, afterAll } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { getTeamXpHistory } from "../../src/db/teamXpHistory.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  insertTestTeam,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
  type BingoTeamRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[team-xp-history.test.ts] skipping: ${stack.reason}`);
}

async function historyTableExists(): Promise<boolean> {
  const { error } = await getDb().from("bingo_player_hiscore_history").select("id").limit(0);
  if (!error) return true;
  return (error as { code?: string }).code !== "42P01";
}

const migrationApplied = stack.reachable ? await historyTableExists() : false;
if (stack.reachable && !migrationApplied) {
  console.warn(
    "[team-xp-history.test.ts] skipping: bingo_player_hiscore_history table not found",
  );
}

const suite = stack.reachable && migrationApplied;
const createdBingoIds: string[] = [];

async function insertTestPlayer(bingoId: string, teamId: string | null, rsn: string): Promise<string> {
  const { data, error } = await getDb()
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn, team_id: teamId })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert test player "${rsn}": ${error?.message}`);
  return (data as { id: string }).id;
}

async function pushPoint(
  playerId: string,
  type: "start" | "current",
  totalXp: number,
  takenAt: Date,
): Promise<void> {
  const rpc = type === "start" ? "upsert_player_hiscore_start" : "upsert_player_hiscore_current";
  const { error } = await getDb().rpc(rpc, {
    p_player_id: playerId,
    p_side_account_id: null,
    p_skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: totalXp }],
    p_activities: [],
    p_taken_at: takenAt.toISOString(),
  });
  if (error) throw new Error(`Failed to push ${type} point: ${error.message}`);
}

function daysAgo(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(12, 0, 0, 0); // noon UTC, safely mid-day so the date-bucket is unambiguous
  return d;
}

describe.skipIf(!suite)("getTeamXpHistory", () => {
  let bingo: BingoRow;
  let teamA: BingoTeamRow;
  let teamB: BingoTeamRow;
  const now = new Date();
  const d2 = daysAgo(now, 2);
  const d1 = daysAgo(now, 1);
  const d0 = daysAgo(now, 0);

  test("fixtures: bingo with two teams", async () => {
    bingo = await insertTestBingo(`test-xp-history-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    teamA = await insertTestTeam(bingo.id, `TeamA ${uniqueSuffix()}`);
    teamB = await insertTestTeam(bingo.id, `TeamB ${uniqueSuffix()}`);
  });

  test("sums per-player xp gained since each account's own start snapshot, bucketed daily", async () => {
    const p1 = await insertTestPlayer(bingo.id, teamA.id, `XpP1${uniqueSuffix()}`);
    const p2 = await insertTestPlayer(bingo.id, teamA.id, `XpP2${uniqueSuffix()}`);

    // p1: start 1,000 -> +2,000 (d1) -> +1,000 more (d0)
    await pushPoint(p1, "start", 1_000, d2);
    await pushPoint(p1, "current", 3_000, d1);
    await pushPoint(p1, "current", 4_000, d0);

    // p2: start 500 (later than p1's start, on d1) -> +1,500 (d0)
    await pushPoint(p2, "start", 500, d1);
    await pushPoint(p2, "current", 2_000, d0);

    const teams = [
      { id: teamA.id, name: teamA.name, sortOrder: 0 },
      { id: teamB.id, name: teamB.name, sortOrder: 1 },
    ];
    const result = await getTeamXpHistory(bingo.id, teams);

    const teamAResult = result.find((t) => t.teamId === teamA.id)!;
    expect(teamAResult).toBeDefined();

    const byDate = new Map(teamAResult.series.map((p) => [p.date.slice(0, 10), p.totalXpGained]));
    // d2: only p1 has data (baseline itself, 0 gained). p2 has no data yet -> contributes 0.
    expect(byDate.get(d2.toISOString().slice(0, 10))).toBe(0);
    // d1: p1 gained 2,000 (3,000-1,000); p2 is its own baseline (0 gained) -> 2,000
    expect(byDate.get(d1.toISOString().slice(0, 10))).toBe(2_000);
    // d0: p1 gained 3,000 (4,000-1,000); p2 gained 1,500 (2,000-500) -> 4,500
    expect(byDate.get(d0.toISOString().slice(0, 10))).toBe(4_500);

    // teamB has no players -> empty series, but is still present (frozen contract: every team listed)
    const teamBResult = result.find((t) => t.teamId === teamB.id)!;
    expect(teamBResult).toBeDefined();
    expect(teamBResult.series).toEqual([]);
  });

  test("a player with no start snapshot yet is excluded entirely", async () => {
    const withStart = await insertTestPlayer(bingo.id, teamB.id, `HasStart${uniqueSuffix()}`);
    const withoutStart = await insertTestPlayer(bingo.id, teamB.id, `NoStart${uniqueSuffix()}`);

    await pushPoint(withStart, "start", 100, d1);
    await pushPoint(withStart, "current", 900, d0);
    // withoutStart only ever gets a 'current' row (simulates a race where the
    // start snapshot failed) — must not blow up or count toward the team.
    await pushPoint(withoutStart, "current", 5_000, d0);

    const teams = [{ id: teamB.id, name: teamB.name, sortOrder: 0 }];
    const result = await getTeamXpHistory(bingo.id, teams);
    const teamBResult = result.find((t) => t.teamId === teamB.id)!;

    const d0Point = teamBResult.series.find((p) => p.date.slice(0, 10) === d0.toISOString().slice(0, 10));
    expect(d0Point!.totalXpGained).toBe(800); // only withStart's 900-100, not withoutStart's 5,000
  });

  test("unassigned (no team_id) players never contribute to any team's series", async () => {
    const unassigned = await insertTestPlayer(bingo.id, null, `Unassigned${uniqueSuffix()}`);
    await pushPoint(unassigned, "start", 10, d1);
    await pushPoint(unassigned, "current", 99_999, d0);

    const teams = [
      { id: teamA.id, name: teamA.name, sortOrder: 0 },
      { id: teamB.id, name: teamB.name, sortOrder: 1 },
    ];
    const result = await getTeamXpHistory(bingo.id, teams);
    // Neither team's d0 total should include the unassigned player's 99,979 gain.
    for (const team of result) {
      const d0Point = team.series.find((p) => p.date.slice(0, 10) === d0.toISOString().slice(0, 10));
      if (d0Point) expect(d0Point.totalXpGained).toBeLessThan(90_000);
    }
  });

  test("a bingo with zero rostered players returns every team with an empty series", async () => {
    const emptyBingo = await insertTestBingo(`test-xp-history-empty-${uniqueSuffix()}`);
    createdBingoIds.push(emptyBingo.id);
    const team = await insertTestTeam(emptyBingo.id, `Empty ${uniqueSuffix()}`);

    const result = await getTeamXpHistory(emptyBingo.id, [{ id: team.id, name: team.name, sortOrder: 0 }]);
    expect(result).toEqual([{ teamId: team.id, teamName: team.name, series: [] }]);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
