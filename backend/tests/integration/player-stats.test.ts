import { describe, test, expect, afterAll } from "bun:test";

import { registerBingoPlayer, addSideAccount } from "../../src/db/players.js";
import { insertPendingSubmission, getPendingSubmissions, approveSubmission } from "../../src/db/bingoSubmissions.js";
import { getPlayerStats } from "../../src/db/playerStats.js";
import {
  getLocalStackConfig,
  columnExists,
  insertTestBingo,
  insertTestTeam,
  insertTestTile,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
  type BingoTeamRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[player-stats.test.ts] skipping: ${stack.reason}`);
}
const hasPlayerIdColumn = stack.reachable ? await columnExists("bingo_submissions", "player_id") : false;
if (stack.reachable && !hasPlayerIdColumn) {
  console.warn(
    "[player-stats.test.ts] skipping: bingo_submissions.player_id column not present " +
      "(contract 1 migration not applied yet — see TEAM-BRIEF.md NOTE)",
  );
}

const suite = stack.reachable && hasPlayerIdColumn;
const createdBingoIds: string[] = [];

async function approveAsPlayer(
  bingoId: string,
  teamId: string,
  tileId: string,
  playerId: string,
): Promise<void> {
  const discordMessageId = `msg-${uniqueSuffix()}`;
  await insertPendingSubmission({ bingoId, discordMessageId, imagePath: `test/${discordMessageId}.png` });
  const pending = await getPendingSubmissions(bingoId);
  const row = pending.find((s) => s.discord_message_id === discordMessageId);
  if (!row) throw new Error("fixture: inserted submission not found among pending");
  await approveSubmission(row.id, { tileId, teamId, playerId });
}

describe.skipIf(!suite)("getPlayerStats (contract 3)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let tileA: { id: string; points: number };
  let tileB: { id: string; points: number };
  let activePlayerId: string;
  let unassignedPlayerId: string;

  test("fixtures: bingo, team, two tiles, two players, one side account, two approved submissions", async () => {
    bingo = await insertTestBingo(`test-stats-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `Team ${uniqueSuffix()}`);
    tileA = await insertTestTile(bingo.id, { position: 0, type: "Drops", task: "Tile A", points: 15 });
    tileB = await insertTestTile(bingo.id, { position: 1, type: "Drops", task: "Tile B", points: 25 });

    const activePlayer = await registerBingoPlayer(bingo.id, `StatsPlayer${uniqueSuffix()}`, team.id);
    activePlayerId = activePlayer.id;
    await addSideAccount(activePlayerId, `StatsAlt${uniqueSuffix()}`);

    const unassignedPlayer = await registerBingoPlayer(bingo.id, `UnassignedPlayer${uniqueSuffix()}`);
    unassignedPlayerId = unassignedPlayer.id;

    // Two approved submissions on two distinct tiles for the active player.
    await approveAsPlayer(bingo.id, team.id, tileA.id, activePlayerId);
    await approveAsPlayer(bingo.id, team.id, tileB.id, activePlayerId);
    // A second approved submission on the SAME tile must not double-count
    // (tilesCompleted / totalPoints are per distinct tile).
    await approveAsPlayer(bingo.id, team.id, tileA.id, activePlayerId);
  });

  test("aggregates distinct tiles, points, side accounts, teamName for an active player", async () => {
    const stats = await getPlayerStats(bingo.id);
    const activeStat = stats.find((s) => s.rsn.startsWith("StatsPlayer"));
    expect(activeStat).toBeDefined();
    expect(activeStat!.teamName).toBe(team.name);
    expect(activeStat!.tilesCompleted).toBe(2); // tileA + tileB, dedupe the repeat on tileA
    expect(activeStat!.totalPoints).toBe(tileA.points + tileB.points);
    expect(activeStat!.sideAccounts.length).toBe(1);
    expect(activeStat!.sideAccounts[0]).toMatch(/^StatsAlt/);
    expect(activeStat!.lastSeen).not.toBeNull();
  });

  test("unassigned player (no team) gets teamName '' and zeroed stats", async () => {
    const stats = await getPlayerStats(bingo.id);
    const unassignedStat = stats.find((s) => s.rsn.startsWith("UnassignedPlayer"));
    expect(unassignedStat).toBeDefined();
    expect(unassignedStat!.teamName).toBe("");
    expect(unassignedStat!.tilesCompleted).toBe(0);
    expect(unassignedStat!.totalPoints).toBe(0);
    expect(unassignedStat!.sideAccounts).toEqual([]);
  });

  test("returns one row per registered player, no N+1 shape surprises (array length)", async () => {
    const stats = await getPlayerStats(bingo.id);
    expect(stats.length).toBe(2);
  });

  test("empty bingo (no players) returns an empty array", async () => {
    const emptyBingo = await insertTestBingo(`test-stats-empty-${uniqueSuffix()}`);
    createdBingoIds.push(emptyBingo.id);
    const stats = await getPlayerStats(emptyBingo.id);
    expect(stats).toEqual([]);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
