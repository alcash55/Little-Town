import { getDb } from "./client.js";

// -------------------------------------------------------
// Types (contract: GET /api/bingo/:bingoId/conflicts, TEAM-BRIEF.md Track B)
// -------------------------------------------------------

export interface ConflictWindow {
  start: string; // ISO-8601
  end: string; // ISO-8601
  mainXpGained: number;
  sideXpGained: number;
}

export interface PlayerConflict {
  playerId: string;
  rsn: string;
  sideRsn: string;
  windows: ConflictWindow[];
  severity: "low" | "high";
}

interface HistoryPoint {
  takenAt: string; // ISO-8601, from bingo_player_hiscore_history.taken_at
  totalXp: number;
}

interface Interval {
  start: string;
  end: string;
  xpGained: number;
}

/**
 * ===========================================================================
 * Side-account conflict detection rules
 * ===========================================================================
 * A "conflict" is main + side account of the same registered player both
 * gaining XP during overlapping stretches of real time — i.e. plausible
 * evidence the two RSNs were played simultaneously by different people (or
 * simultaneously boosted), which a single-account bingo entry shouldn't be.
 *
 * 1. Data source: bingo_player_hiscore_history (20260711000000_hiscore_
 *    conflict_history.sql), an append-only log fed by a DB trigger on every
 *    write to bingo_player_hiscores. bingo_player_hiscores itself only ever
 *    holds the latest 'start'/'current' pair per account (current is
 *    overwritten in place), so it alone can't describe more than one
 *    XP-gain window — the history table is what makes repeated-conflict
 *    detection possible at all.
 *
 * 2. Per account (main or side), consecutive history points ordered by
 *    taken_at form "windows": window i = [point[i].taken_at,
 *    point[i+1].taken_at], xpGained = point[i+1].totalXp - point[i].totalXp.
 *    A window only counts as XP-gaining if xpGained > 0 (flat or negative
 *    deltas — e.g. a re-poll with no play in between — are dropped; XP
 *    cannot legitimately decrease, so a negative delta is treated as noise,
 *    not a conflict signal).
 *
 * 3. For each (main player, side account) pair, a "conflict window" is any
 *    point where one of the main account's XP-gaining windows overlaps in
 *    time with one of the side account's XP-gaining windows (i.e. both
 *    accounts were observed gaining XP during some shared stretch of time).
 *    The reported {start, end} is the intersection of the two windows;
 *    mainXpGained/sideXpGained are each window's full observed gain (NOT
 *    apportioned to the overlap sub-range — snapshots aren't frequent
 *    enough to say how XP was distributed within a window, only that both
 *    accounts gained some).
 *
 * 4. A main window can overlap more than one side window and vice versa —
 *    each distinct overlapping pair is reported as its own entry in
 *    `windows`. A pair with zero overlapping windows produces no conflict
 *    entry at all (nothing to report).
 *
 * 5. Severity ("low" vs "high", per the frozen contract): "high" when the
 *    same (main, side) pair has more than one conflicting window; "low"
 *    for exactly one. This is why history (not just start/current) matters
 *    — a bingo that runs for weeks with the cron polling every 20 minutes
 *    can surface a side account that repeatedly, not just once, gains XP
 *    alongside the main account.
 * ===========================================================================
 */

/**
 * Turns a chronologically-sorted list of (taken_at, totalXp) points into the
 * XP-gaining windows between consecutive points (rule 2 above).
 */
function toGainingWindows(points: HistoryPoint[]): Interval[] {
  const windows: Interval[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const xpGained = curr.totalXp - prev.totalXp;
    if (xpGained > 0) {
      windows.push({ start: prev.takenAt, end: curr.takenAt, xpGained });
    }
  }
  return windows;
}

/**
 * Finds every overlapping (mainWindow, sideWindow) pair between two lists of
 * chronologically-sorted, non-overlapping-within-their-own-list intervals
 * (rule 3/4 above). Two-pointer sweep — O(main + side) rather than the naive
 * O(main * side) — since both inputs are already sorted by start time.
 */
function overlappingWindows(mainWindows: Interval[], sideWindows: Interval[]): ConflictWindow[] {
  const result: ConflictWindow[] = [];
  let i = 0;
  let j = 0;

  while (i < mainWindows.length && j < sideWindows.length) {
    const m = mainWindows[i];
    const s = sideWindows[j];

    const overlapStart = m.start > s.start ? m.start : s.start;
    const overlapEnd = m.end < s.end ? m.end : s.end;

    if (overlapStart < overlapEnd) {
      result.push({
        start: overlapStart,
        end: overlapEnd,
        mainXpGained: m.xpGained,
        sideXpGained: s.xpGained,
      });
    }

    // Advance whichever window ends first — it can't overlap anything
    // further along in the other list.
    if (m.end < s.end) i++;
    else j++;
  }

  return result;
}

/**
 * Detects main/side-account XP-gain conflicts for every player in a bingo.
 * Three bulk, indexed queries (players, side accounts, history points) —
 * no per-player round trips — followed by an in-memory pass per rules 2-5
 * above. See the doc comment block for the detection rules themselves.
 */
export async function getBingoConflicts(bingoId: string): Promise<PlayerConflict[]> {
  const db = getDb();

  const { data: players, error: playersError } = await db
    .from("bingo_players")
    .select("id, rsn")
    .eq("bingo_id", bingoId);

  if (playersError) throw new Error(`Failed to get players: ${playersError.message}`);
  const playerRows = (players ?? []) as Array<{ id: string; rsn: string }>;
  if (!playerRows.length) return [];

  const playerIds = playerRows.map((p) => p.id);

  const { data: sideAccounts, error: sideError } = await db
    .from("bingo_player_side_accounts")
    .select("id, player_id, rsn")
    .in("player_id", playerIds);

  if (sideError) throw new Error(`Failed to get side accounts: ${sideError.message}`);
  const sideAccountRows = (sideAccounts ?? []) as Array<{
    id: string;
    player_id: string;
    rsn: string;
  }>;
  if (!sideAccountRows.length) return [];

  const sideAccountIds = sideAccountRows.map((s) => s.id);

  const [mainHistoryRes, sideHistoryRes] = await Promise.all([
    db
      .from("bingo_player_hiscore_history")
      .select("player_id, total_xp, taken_at")
      .in("player_id", playerIds)
      .is("side_account_id", null)
      .order("taken_at", { ascending: true }),
    db
      .from("bingo_player_hiscore_history")
      .select("side_account_id, total_xp, taken_at")
      .in("side_account_id", sideAccountIds)
      .order("taken_at", { ascending: true }),
  ]);

  if (mainHistoryRes.error) {
    throw new Error(`Failed to get main account history: ${mainHistoryRes.error.message}`);
  }
  if (sideHistoryRes.error) {
    throw new Error(`Failed to get side account history: ${sideHistoryRes.error.message}`);
  }

  const mainPointsByPlayer = new Map<string, HistoryPoint[]>();
  for (const row of (mainHistoryRes.data ?? []) as Array<{
    player_id: string;
    total_xp: number;
    taken_at: string;
  }>) {
    if (!mainPointsByPlayer.has(row.player_id)) mainPointsByPlayer.set(row.player_id, []);
    mainPointsByPlayer.get(row.player_id)!.push({ takenAt: row.taken_at, totalXp: row.total_xp });
  }

  const sidePointsByAccount = new Map<string, HistoryPoint[]>();
  for (const row of (sideHistoryRes.data ?? []) as Array<{
    side_account_id: string;
    total_xp: number;
    taken_at: string;
  }>) {
    if (!sidePointsByAccount.has(row.side_account_id)) sidePointsByAccount.set(row.side_account_id, []);
    sidePointsByAccount
      .get(row.side_account_id)!
      .push({ takenAt: row.taken_at, totalXp: row.total_xp });
  }

  // Rows are already ordered by taken_at ascending; both maps' arrays are
  // used directly (no additional in-memory sort needed).
  const mainWindowsByPlayer = new Map<string, Interval[]>();
  for (const [playerId, points] of mainPointsByPlayer) {
    mainWindowsByPlayer.set(playerId, toGainingWindows(points));
  }

  const conflicts: PlayerConflict[] = [];

  for (const player of playerRows) {
    const mainWindows = mainWindowsByPlayer.get(player.id);
    if (!mainWindows?.length) continue;

    const playerSideAccounts = sideAccountRows.filter((s) => s.player_id === player.id);
    for (const sideAccount of playerSideAccounts) {
      const sidePoints = sidePointsByAccount.get(sideAccount.id);
      if (!sidePoints?.length) continue;

      const sideWindows = toGainingWindows(sidePoints);
      if (!sideWindows.length) continue;

      const windows = overlappingWindows(mainWindows, sideWindows);
      if (!windows.length) continue;

      conflicts.push({
        playerId: player.id,
        rsn: player.rsn,
        sideRsn: sideAccount.rsn,
        windows,
        severity: windows.length > 1 ? "high" : "low",
      });
    }
  }

  conflicts.sort((a, b) => a.rsn.localeCompare(b.rsn) || a.sideRsn.localeCompare(b.sideRsn));

  return conflicts;
}
