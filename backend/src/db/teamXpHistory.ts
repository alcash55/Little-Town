import { getDb } from "./client.js";
import { BingoTeam } from "../types/index.js";

// -------------------------------------------------------
// Types (contract: GET /api/bingo/team-xp-history, TEAM-BRIEF.md Track A item 3)
// -------------------------------------------------------

export interface TeamXpSeriesPoint {
  date: string; // ISO-8601, UTC midnight of the bucket day
  totalXpGained: number;
}

export interface TeamXpHistory {
  teamId: string;
  teamName: string;
  series: TeamXpSeriesPoint[];
}

interface HistoryRow {
  player_id: string;
  total_xp: number;
  taken_at: string;
  type: "start" | "current";
}

/**
 * ===========================================================================
 * Bucketing rules (documented per the brief's ask)
 * ===========================================================================
 * Data source: bingo_player_hiscore_history (20260711000000_hiscore_
 * conflict_history.sql), main accounts only (side_account_id IS NULL) — same
 * "headline series" restriction the brief calls for; side accounts never
 * contribute to a team's chart.
 *
 * 1. Each player's baseline is their own 'start' history row's total_xp
 *    (there is exactly one, written once at registration/activation — see
 *    savePlayerSnapshot). A player with no 'start' row yet (registered but
 *    never snapshotted) is excluded entirely — there is nothing to measure
 *    "gained since start" against.
 * 2. Points are bucketed into UTC calendar-day buckets (`taken_at`'s date
 *    part). Multiple observations on the same day collapse to that day's
 *    max total_xp (XP is monotonic non-decreasing during a bingo — same
 *    assumption src/db/conflicts.ts makes — so max and "latest" agree modulo
 *    clock/ordering noise; max is the more defensive choice of the two).
 * 3. The chart's x-axis is the UNION of every date that has at least one
 *    observation from any included player in the bingo — NOT a filled-in
 *    contiguous calendar range. A bingo with sparse cron ticks gets a sparse
 *    but honest chart rather than a smoothed one.
 * 4. A team's value on a given date is the SUM, over that team's included
 *    players, of each player's (xp as of that date) - (their own baseline).
 *    "As of that date" carries a player's last known value forward across
 *    dates where they have no new observation (e.g. one player's account
 *    stopped reporting) rather than treating them as flat-zero on days nrom
 *    other players still have data — otherwise a single missed cron tick for
 *    one player would visibly dip the whole team's cumulative line.
 * 5. Players with no team assignment don't contribute to any team's series.
 *    Teams with zero eligible players get an empty `series` (not omitted —
 *    every configured team is always present, per the frozen contract).
 * ===========================================================================
 */
export async function getTeamXpHistory(bingoId: string, teams: BingoTeam[]): Promise<TeamXpHistory[]> {
  const db = getDb();

  const { data: players, error: playersError } = await db
    .from("bingo_players")
    .select("id, team_id")
    .eq("bingo_id", bingoId)
    .not("team_id", "is", null);

  if (playersError) throw new Error(`Failed to get players: ${playersError.message}`);
  const playerRows = (players ?? []) as Array<{ id: string; team_id: string }>;

  if (!playerRows.length) {
    return teams.map((team) => ({ teamId: team.id, teamName: team.name, series: [] }));
  }

  const playerIds = playerRows.map((p) => p.id);
  const teamByPlayer = new Map(playerRows.map((p) => [p.id, p.team_id]));

  const { data: history, error: historyError } = await db
    .from("bingo_player_hiscore_history")
    .select("player_id, total_xp, taken_at, type")
    .in("player_id", playerIds)
    .is("side_account_id", null)
    .order("taken_at", { ascending: true });

  if (historyError) throw new Error(`Failed to get hiscore history: ${historyError.message}`);
  const rows = (history ?? []) as HistoryRow[];

  // Rule 1: baseline = earliest 'start' row's total_xp per player.
  const baselineByPlayer = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== "start") continue;
    if (!baselineByPlayer.has(row.player_id)) baselineByPlayer.set(row.player_id, row.total_xp);
  }

  // Rule 2: per-player, per-day max total_xp; also collect the global date union.
  const dailyByPlayer = new Map<string, Map<string, number>>();
  const allDates = new Set<string>();
  for (const row of rows) {
    if (!baselineByPlayer.has(row.player_id)) continue;
    const date = row.taken_at.slice(0, 10);
    allDates.add(date);
    let perPlayer = dailyByPlayer.get(row.player_id);
    if (!perPlayer) {
      perPlayer = new Map();
      dailyByPlayer.set(row.player_id, perPlayer);
    }
    const prevMax = perPlayer.get(date);
    if (prevMax === undefined || row.total_xp > prevMax) perPlayer.set(date, row.total_xp);
  }

  const sortedDates = Array.from(allDates).sort();

  const sortedSeriesByPlayer = new Map<string, Array<{ date: string; value: number }>>();
  for (const [playerId, dailyMap] of dailyByPlayer) {
    const arr = Array.from(dailyMap.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
    sortedSeriesByPlayer.set(playerId, arr);
  }

  // Rule 5: group eligible (team-assigned, has a baseline) players by team.
  const playersByTeam = new Map<string, string[]>();
  for (const [playerId, teamId] of teamByPlayer) {
    if (!baselineByPlayer.has(playerId)) continue;
    if (!playersByTeam.has(teamId)) playersByTeam.set(teamId, []);
    playersByTeam.get(teamId)!.push(playerId);
  }

  return teams.map((team) => {
    const teamPlayerIds = playersByTeam.get(team.id) ?? [];
    if (!teamPlayerIds.length || !sortedDates.length) {
      return { teamId: team.id, teamName: team.name, series: [] };
    }

    // Rule 4: two-pointer carry-forward walk per player across sortedDates.
    const seriesIndex = new Map<string, number>(teamPlayerIds.map((id) => [id, -1]));
    const currentValue = new Map<string, number>(
      teamPlayerIds.map((id) => [id, baselineByPlayer.get(id)!]),
    );

    const series: TeamXpSeriesPoint[] = sortedDates.map((date) => {
      for (const playerId of teamPlayerIds) {
        const playerSeries = sortedSeriesByPlayer.get(playerId) ?? [];
        let i = seriesIndex.get(playerId)!;
        while (i + 1 < playerSeries.length && playerSeries[i + 1].date <= date) {
          i++;
          currentValue.set(playerId, playerSeries[i].value);
        }
        seriesIndex.set(playerId, i);
      }

      const totalXpGained = teamPlayerIds.reduce(
        (sum, playerId) => sum + Math.max(0, currentValue.get(playerId)! - baselineByPlayer.get(playerId)!),
        0,
      );

      return { date: `${date}T00:00:00.000Z`, totalXpGained };
    });

    return { teamId: team.id, teamName: team.name, series };
  });
}
