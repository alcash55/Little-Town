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

import { registerBingoPlayer, savePlayerSnapshot } from "../../src/db/players.js";
import { insertPendingSubmission, getPendingSubmissions, approveSubmission } from "../../src/db/bingoSubmissions.js";
import { getPlayerStats } from "../../src/db/playerStats.js";
import { getTeamStats, getTeamStatsWithUnresolvable } from "../../src/db/playerStats.js";
import type { HiscoreData } from "../../src/types/index.js";
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

function buildHiscoreData(kc: number, activityName = "Tombs of Amascut"): HiscoreData {
  return {
    name: "test",
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 0 }],
    activities: [{ id: 2, name: activityName, rank: 500, kc }],
    updatedAt: new Date(),
  };
}

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

// -------------------------------------------------------
// TEAM-BRIEF.md Sprint 13, Track A — engine-driven team-stats: dedupe rule
// (legacy ToA scenario) + unresolvableTiles.
// -------------------------------------------------------

describe.skipIf(!suite)("getTeamStatsWithUnresolvable (Sprint 13, Track A — completion engine)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let killCountTile: { id: string; points: number };
  let unmatchedTile: { id: string; task: string; points: number };
  let playerId: string;

  test("fixtures: a Kill Count tile with real auto-verifying snapshot deltas PLUS two legacy approved submissions on it (prod's exact ToA scenario), and an unmatched trackable tile", async () => {
    bingo = await insertTestBingo(`test-team-stats-engine-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `EngineTeam ${uniqueSuffix()}`);

    killCountTile = await insertTestTile(bingo.id, {
      position: 0,
      type: "Kill Count",
      task: "Tombs of Amascut",
      points: 40,
      targetValue: 5,
    });
    const unmatched = await insertTestTile(bingo.id, {
      position: 1,
      type: "Kill Count",
      task: `Definitely Not A Real Boss ${uniqueSuffix()}`,
      points: 10,
      targetValue: 1,
    });
    unmatchedTile = { id: unmatched.id, task: unmatched.task, points: unmatched.points };

    const player = await registerBingoPlayer(bingo.id, `EngineTeamPlayer${uniqueSuffix()}`, team.id);
    playerId = player.id;

    // Real snapshot deltas: 5 KC, meeting the tile's target_value exactly.
    await savePlayerSnapshot(playerId, "start", buildHiscoreData(0));
    await savePlayerSnapshot(playerId, "current", buildHiscoreData(5));

    // Two legacy approved submissions sitting on the SAME (now-trackable)
    // tile id — exactly prod's reported state ("two legacy ToA submissions
    // ... must not double-count once ToA auto-verifies").
    await approveWithAttribution(bingo.id, team.id, killCountTile.id, playerId);
    await approveWithAttribution(bingo.id, team.id, killCountTile.id, playerId);
  });

  test("dedupe: the Kill Count tile counts ONCE toward the team total, from the engine — not tripled by the two legacy submissions", async () => {
    const { teams } = await getTeamStatsWithUnresolvable(bingo.id);
    const teamStat = teams.find((t) => t.teamId === team.id)!;
    expect(teamStat.tilesCompleted).toBe(1);
    expect(teamStat.totalPoints).toBe(killCountTile.points); // 40, not 80/120
  });

  test("dedupe: getPlayerStats never counts the legacy Kill Count submissions either (Drops-only per item 3)", async () => {
    const playerStats = await getPlayerStats(bingo.id);
    const stat = playerStats.find((s) => s.rsn.startsWith("EngineTeamPlayer"))!;
    expect(stat.tilesCompleted).toBe(0);
    expect(stat.totalPoints).toBe(0);
  });

  test("unresolvableTiles lists the unmatched trackable tile so an admin can fix its task text", async () => {
    const { unresolvableTiles } = await getTeamStatsWithUnresolvable(bingo.id);
    expect(unresolvableTiles).toContainEqual({
      id: unmatchedTile.id,
      task: unmatchedTile.task,
      type: "Kill Count",
    });
    // The matched, auto-verified tile is never reported as unresolvable.
    expect(unresolvableTiles.some((t) => t.id === killCountTile.id)).toBe(false);
  });

  test("the unmatched tile never completes for the team, regardless of the legacy submissions sitting elsewhere on the board", async () => {
    const { teams } = await getTeamStatsWithUnresolvable(bingo.id);
    const teamStat = teams.find((t) => t.teamId === team.id)!;
    // tilesCompleted is still exactly 1 (only the auto-verified KC tile) —
    // the unmatched tile contributes nothing.
    expect(teamStat.tilesCompleted).toBe(1);
  });

  test("getTeamStats() (the thin wrapper) returns the same per-team array as the .teams field", async () => {
    const viaWrapper = await getTeamStats(bingo.id);
    const { teams } = await getTeamStatsWithUnresolvable(bingo.id);
    expect(viaWrapper).toEqual(teams);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
