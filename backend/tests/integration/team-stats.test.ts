/**
 * getTeamStats (src/db/playerStats.ts) — regression coverage for the
 * bug-report investigation's H1 finding: `bingo_submissions.player_id` is
 * an OPTIONAL field an admin fills in at approval time (frontend
 * ScreenshotCard's "Player (optional)" picker, default "Unassigned"). Every
 * per-player stat (getPlayerStats' tilesCompleted/totalPoints, and
 * /my-team-data's per-player skill/activity/drop rows) is keyed off
 * player_id — an approved submission with no player_id contributes to NONE
 * of them, so a team can have visibly completed a tile that never shows up
 * anywhere per-player.
 *
 * getTeamStats() is the degrade-gracefully fix: a team-level total computed
 * straight from team_id (never player_id), so an admin can see the team
 * genuinely completed the tile even when no player-level view reflects it,
 * plus a count of exactly how many of those tiles/points are unattributed
 * (actionable — an admin knows there's a gap to go fix, instead of data
 * silently vanishing).
 */
import { afterAll, describe, expect, test } from "bun:test";

import { registerBingoPlayer } from "../../src/db/players.js";
import { insertPendingSubmission, getPendingSubmissions, approveSubmission } from "../../src/db/bingoSubmissions.js";
import { getPlayerStats } from "../../src/db/playerStats.js";
import { getTeamStats } from "../../src/db/playerStats.js";
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
  console.warn(`[team-stats.test.ts] skipping: ${stack.reason}`);
}
const hasPlayerIdColumn = stack.reachable ? await columnExists("bingo_submissions", "player_id") : false;
const suite = stack.reachable && hasPlayerIdColumn;
const createdBingoIds: string[] = [];

async function approveWithAttribution(
  bingoId: string,
  teamId: string,
  tileId: string,
  playerId?: string,
): Promise<void> {
  const discordMessageId = `msg-${uniqueSuffix()}`;
  await insertPendingSubmission({ bingoId, discordMessageId, imagePath: `test/${discordMessageId}.png` });
  const pending = await getPendingSubmissions(bingoId);
  const row = pending.find((s) => s.discord_message_id === discordMessageId);
  if (!row) throw new Error("fixture: inserted submission not found among pending");
  await approveSubmission(row.id, { tileId, teamId, playerId });
}

describe.skipIf(!suite)("getTeamStats (attribution-independent team completion)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let attributedTile: { id: string; points: number };
  let unattributedTile: { id: string; points: number };
  let playerId: string;

  test("fixtures: one team, two tiles — one approved WITH player attribution, one WITHOUT", async () => {
    bingo = await insertTestBingo(`test-team-stats-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `Team ${uniqueSuffix()}`);
    attributedTile = await insertTestTile(bingo.id, { position: 0, type: "Drops", task: "Attributed", points: 10 });
    unattributedTile = await insertTestTile(bingo.id, { position: 1, type: "Drops", task: "Unattributed", points: 30 });

    const player = await registerBingoPlayer(bingo.id, `TeamStatsPlayer${uniqueSuffix()}`, team.id);
    playerId = player.id;

    // Attributed: player_id set at approval time.
    await approveWithAttribution(bingo.id, team.id, attributedTile.id, playerId);
    // Unattributed: admin approved without picking a player (playerId
    // omitted entirely — the "Unassigned" default in ScreenshotCard).
    await approveWithAttribution(bingo.id, team.id, unattributedTile.id);
  });

  test("team total counts BOTH tiles (attribution-independent ground truth)", async () => {
    const stats = await getTeamStats(bingo.id);
    const teamStat = stats.find((s) => s.teamId === team.id);
    expect(teamStat).toBeDefined();
    expect(teamStat!.tilesCompleted).toBe(2);
    expect(teamStat!.totalPoints).toBe(attributedTile.points + unattributedTile.points);
  });

  test("unattributedTiles/unattributedPoints isolate exactly the gap", () => {
    return getTeamStats(bingo.id).then((stats) => {
      const teamStat = stats.find((s) => s.teamId === team.id)!;
      expect(teamStat.unattributedTiles).toBe(1);
      expect(teamStat.unattributedPoints).toBe(unattributedTile.points);
    });
  });

  test("cross-check: player-level getPlayerStats under-counts by exactly the unattributed tile (proves the gap this fixes)", async () => {
    const playerStats = await getPlayerStats(bingo.id);
    const stat = playerStats.find((s) => s.rsn.startsWith("TeamStatsPlayer"));
    expect(stat).toBeDefined();
    // Only the attributed tile shows up per-player — the unattributed one
    // is invisible here, which is exactly the reported symptom.
    expect(stat!.tilesCompleted).toBe(1);
    expect(stat!.totalPoints).toBe(attributedTile.points);
  });

  test("a team with no approved submissions gets zeroed stats, not omitted", async () => {
    const emptyTeam = await insertTestTeam(bingo.id, `EmptyTeam ${uniqueSuffix()}`);
    const stats = await getTeamStats(bingo.id);
    const emptyStat = stats.find((s) => s.teamId === emptyTeam.id);
    expect(emptyStat).toBeDefined();
    expect(emptyStat!.tilesCompleted).toBe(0);
    expect(emptyStat!.totalPoints).toBe(0);
    expect(emptyStat!.unattributedTiles).toBe(0);
  });

  test("a tile with at least one ATTRIBUTED submission is never double-counted as unattributed by a later unattributed dupe", async () => {
    // Same tile, second approval this time without attribution — the tile
    // as a whole is still "attributed" (>=1 submission had a player_id).
    await approveWithAttribution(bingo.id, team.id, attributedTile.id);
    const stats = await getTeamStats(bingo.id);
    const teamStat = stats.find((s) => s.teamId === team.id)!;
    expect(teamStat.tilesCompleted).toBe(2); // unchanged — same two distinct tiles
    expect(teamStat.unattributedTiles).toBe(1); // still just the one genuinely-unattributed tile
  });

  test("empty bingo (no teams) returns an empty array", async () => {
    const emptyBingo = await insertTestBingo(`test-team-stats-empty-${uniqueSuffix()}`);
    createdBingoIds.push(emptyBingo.id);
    const stats = await getTeamStats(emptyBingo.id);
    expect(stats).toEqual([]);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
