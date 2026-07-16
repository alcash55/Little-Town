/**
 * The single tile-completion engine (TEAM-BRIEF.md Sprint 13, Track A item
 * 1-2 — "one completion engine, one source of truth"). Every route that
 * used to compute "is this tile done for this team" its own way
 * (GET /api/bingo/board's completedByMyTeam, GET /api/admin/bingo/team-stats,
 * GET /api/bingo/my-team-data's per-tile display) now goes through
 * `computeBingoCompletion` below instead of re-deriving it.
 *
 * Product model this sprint (Alex, frozen — see TEAM-BRIEF.md "Product
 * decisions"):
 *
 *   - Kill Count and Experience tiles are 100% hiscore-driven: a team
 *     completes one when the SUM of its members' (current − start) deltas
 *     for the matched skill/activity reaches the tile's target_value.
 *     Screenshots/approvals are NEVER consulted for these tile types,
 *     regardless of what's sitting in bingo_submissions — this is what
 *     makes the per-team-per-tile dedupe rule trivially true: prod has two
 *     legacy approved ToA submissions from before ToA became trackable;
 *     once ToA's task resolves to a hiscore activity, those rows are simply
 *     never read by this engine, so they can't double-count against the
 *     auto-verified total no matter how many of them exist.
 *   - Drops tiles are still 100% submission-driven: a team completes one
 *     when it has >=1 APPROVED bingo_submissions row for that tile+team.
 *   - A trackable tile (Kill Count/Experience) whose `task` text doesn't
 *     normalize-match any name in the OSRS hiscores skill/activity
 *     vocabulary NEVER auto-completes for anyone — it's reported in
 *     `unresolvableTiles` instead so an admin can fix the task text via the
 *     Board Builder. No submission-based fallback exists for these (by
 *     design — see the dedupe note above).
 *
 * Side accounts: a player's side-account snapshot deltas ARE summed into
 * their contribution (recommendation adopted per TEAM-BRIEF.md item 1 — a
 * side account is the same real person's gains, and per-side-account start/
 * current snapshots already exist via services/sideAccountSnapshots.ts).
 *
 * Two layers:
 *   - Pure math (normalizeTaskText, resolveTileMetric, computeCompletion,
 *     ...) — no DB access, fully unit-testable.
 *   - `computeBingoCompletion` — the DB-touching orchestrator every route
 *     calls: a fixed number of bulk queries (players+snapshots, side
 *     accounts, side-account snapshots, approved Drops submissions),
 *     independent of team/player/tile counts at this app's scale (TEAM-
 *     BRIEF.md item 6 — no caching/materialization this sprint).
 */
import { getDb } from "../db/client.js";
import {
  getAllPlayerSnapshots,
  getAllSideAccounts,
  getSideAccountSnapshotsBulk,
  type PlayerSnapshot,
} from "../db/players.js";

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export type TileType = "Kill Count" | "Experience" | "Drops";

export interface EngineTile {
  id: string;
  task: string;
  type: TileType;
  points: number;
  targetValue: number | null;
}

export interface SnapshotLike {
  skills: Array<{ name: string; xp: number }>;
  activities: Array<{ name: string; kc: number }>;
}

export interface AccountSnapshots {
  start: SnapshotLike | null;
  current: SnapshotLike | null;
}

export interface EnginePlayer {
  playerId: string;
  teamId: string | null;
  /** [mainAccount, ...sideAccounts] — every account's delta is summed for this player. */
  accounts: AccountSnapshots[];
}

export interface ResolvedMetric {
  kind: "skill" | "activity";
  normalizedName: string;
}

export interface HiscoreVocab {
  skillNames: Set<string>;
  activityNames: Set<string>;
}

export interface UnresolvableTile {
  id: string;
  task: string;
  type: TileType;
}

export interface CompletionResult {
  /**
   * teamId -> set of tile ids counted complete for that team. Kill
   * Count/Experience tiles land here purely from the hiscore math; Drops
   * tiles land here from >=1 approved submission for that team+tile. A tile
   * id is NEVER added twice for the same team by two different paths (see
   * the dedupe note in the file header) — each tile type only ever
   * contributes via exactly one path.
   */
  completedTileIdsByTeam: Map<string, Set<string>>;
  /** teamId -> tileId -> summed numeric progress. Kill Count/Experience tiles only. */
  progressByTeamAndTile: Map<string, Map<string, number>>;
  /** teamId -> sum of points for that team's tiles in completedTileIdsByTeam. */
  totalPointsByTeam: Map<string, number>;
  /** Trackable tiles whose task couldn't be matched to a hiscore metric — never auto-complete for anyone. */
  unresolvableTiles: UnresolvableTile[];
}

// -------------------------------------------------------
// Pure math — no DB access, unit-testable in isolation.
// -------------------------------------------------------

/**
 * Case/whitespace normalization for task-text <-> hiscore-name matching.
 * Board tile tasks come from the BoardBuilder's autocomplete, itself fed by
 * the same OSRS hiscore skill/activity vocabulary (services/scrapeWiki.ts),
 * so exact-after-normalization is expected to cover real boards (TEAM-
 * BRIEF.md item 1) — this deliberately does NOT strip punctuation or do
 * fuzzy matching, both of which risk silently matching the wrong metric.
 */
export function normalizeTaskText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Builds the set of valid (normalized) skill/activity names from whatever
 * snapshot data is available across the whole bingo. Every OSRS account
 * returns the same fixed skill/activity name list from the hiscores lite
 * API (only the values differ), so any player's snapshot is authoritative
 * vocabulary — building the union across all of them (rather than picking
 * one arbitrarily) just makes this robust to a single player's snapshot
 * being incomplete/absent.
 */
export function buildHiscoreVocab(players: EnginePlayer[]): HiscoreVocab {
  const skillNames = new Set<string>();
  const activityNames = new Set<string>();
  for (const player of players) {
    for (const account of player.accounts) {
      for (const snapshot of [account.start, account.current]) {
        if (!snapshot) continue;
        for (const skill of snapshot.skills) skillNames.add(normalizeTaskText(skill.name));
        for (const activity of snapshot.activities) activityNames.add(normalizeTaskText(activity.name));
      }
    }
  }
  return { skillNames, activityNames };
}

/**
 * Maps a tile's task text to a hiscore metric. Drops tiles never resolve
 * (they're never trackable — contract 2). Returns null for a trackable tile
 * whose task doesn't normalize-match anything in `vocab` — the tile then
 * belongs in `unresolvableTiles` and never auto-completes.
 */
export function resolveTileMetric(
  tile: Pick<EngineTile, "task" | "type">,
  vocab: HiscoreVocab,
): ResolvedMetric | null {
  if (tile.type === "Drops") return null;
  const normalizedName = normalizeTaskText(tile.task);
  if (tile.type === "Experience") {
    return vocab.skillNames.has(normalizedName) ? { kind: "skill", normalizedName } : null;
  }
  return vocab.activityNames.has(normalizedName) ? { kind: "activity", normalizedName } : null;
}

/** A single account's delta for a resolved metric. Missing start -> 0 (never negative). */
function accountMetricDelta(account: AccountSnapshots, metric: ResolvedMetric): number {
  if (!account.current) return 0;
  if (metric.kind === "skill") {
    const current = account.current.skills.find((s) => normalizeTaskText(s.name) === metric.normalizedName);
    if (!current) return 0;
    const startXp = account.start?.skills.find((s) => normalizeTaskText(s.name) === metric.normalizedName)?.xp;
    const delta = current.xp - (startXp ?? current.xp);
    return delta > 0 ? delta : 0;
  }
  const current = account.current.activities.find((a) => normalizeTaskText(a.name) === metric.normalizedName);
  if (!current) return 0;
  const startKc = account.start?.activities.find((a) => normalizeTaskText(a.name) === metric.normalizedName)?.kc;
  const delta = current.kc - (startKc ?? current.kc);
  return delta > 0 ? delta : 0;
}

/** A single player's delta for a metric, summed across their main + side accounts. */
export function playerMetricDelta(player: EnginePlayer, metric: ResolvedMetric): number {
  return player.accounts.reduce((sum, account) => sum + accountMetricDelta(account, metric), 0);
}

/** Team-total semantics (contract 1): the sum of every member's delta on this team. */
export function teamMetricDelta(players: EnginePlayer[], teamId: string, metric: ResolvedMetric): number {
  return players
    .filter((p) => p.teamId === teamId)
    .reduce((sum, p) => sum + playerMetricDelta(p, metric), 0);
}

/**
 * Pure completion computation — given tiles, every player's account
 * snapshots, the team ids to compute results for, and which team(s) have an
 * approved Drops submission per Drops tile, returns completion/progress/
 * points for every team plus the unresolvable-tile list.
 *
 * `approvedDropsTileIdsByTeam` is consulted ONLY for tiles of type "Drops"
 * — even if a caller's map happens to contain an entry for a Kill Count/
 * Experience tile id (e.g. a legacy approved submission sitting on a tile
 * that's since become trackable), it is never read for that tile. This is
 * the dedupe guarantee, enforced structurally rather than by a runtime
 * "prefer one over the other" check.
 */
export function computeCompletion(
  tiles: EngineTile[],
  players: EnginePlayer[],
  teamIds: string[],
  approvedDropsTileIdsByTeam: Map<string, Set<string>>,
): CompletionResult {
  const vocab = buildHiscoreVocab(players);

  const completedTileIdsByTeam = new Map<string, Set<string>>();
  const progressByTeamAndTile = new Map<string, Map<string, number>>();
  const totalPointsByTeam = new Map<string, number>();
  for (const teamId of teamIds) {
    completedTileIdsByTeam.set(teamId, new Set());
    progressByTeamAndTile.set(teamId, new Map());
    totalPointsByTeam.set(teamId, 0);
  }

  const unresolvableTiles: UnresolvableTile[] = [];

  for (const tile of tiles) {
    if (tile.type === "Drops") {
      for (const teamId of teamIds) {
        if (!approvedDropsTileIdsByTeam.get(teamId)?.has(tile.id)) continue;
        completedTileIdsByTeam.get(teamId)!.add(tile.id);
        totalPointsByTeam.set(teamId, (totalPointsByTeam.get(teamId) ?? 0) + tile.points);
      }
      continue;
    }

    // Kill Count / Experience: hiscore math only, submissions never consulted.
    const metric = resolveTileMetric(tile, vocab);
    if (!metric) {
      unresolvableTiles.push({ id: tile.id, task: tile.task, type: tile.type });
      continue;
    }
    // No target set on an otherwise-resolvable tile — a board-authoring gap,
    // not a matching failure, so it's not reported as unresolvable; it just
    // never has a threshold to reach.
    if (tile.targetValue == null) continue;

    for (const teamId of teamIds) {
      const delta = teamMetricDelta(players, teamId, metric);
      progressByTeamAndTile.get(teamId)!.set(tile.id, delta);
      if (delta >= tile.targetValue) {
        completedTileIdsByTeam.get(teamId)!.add(tile.id);
        totalPointsByTeam.set(teamId, (totalPointsByTeam.get(teamId) ?? 0) + tile.points);
      }
    }
  }

  return { completedTileIdsByTeam, progressByTeamAndTile, totalPointsByTeam, unresolvableTiles };
}

// -------------------------------------------------------
// DB-touching orchestration
// -------------------------------------------------------

function toSnapshotLike(snapshot: PlayerSnapshot | null): SnapshotLike | null {
  if (!snapshot) return null;
  return {
    skills: (snapshot.skills ?? []) as SnapshotLike["skills"],
    activities: (snapshot.activities ?? []) as SnapshotLike["activities"],
  };
}

/**
 * teamId -> set of tile ids with >=1 APPROVED bingo_submissions row for
 * that team, restricted to `dropsTileIds`. Trackable-tile submissions
 * (legacy or otherwise) are structurally excluded by never being queried
 * here in the first place.
 */
async function getApprovedDropsTileIdsByTeam(
  bingoId: string,
  dropsTileIds: string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (!dropsTileIds.length) return result;

  const { data, error } = await getDb()
    .from("bingo_submissions")
    .select("team_id, tile_id")
    .eq("bingo_id", bingoId)
    .eq("status", "approved")
    .in("tile_id", dropsTileIds)
    .not("team_id", "is", null);

  if (error) throw new Error(`Failed to get approved drop submissions: ${error.message}`);

  for (const row of (data ?? []) as Array<{ team_id: string | null; tile_id: string | null }>) {
    if (!row.team_id || !row.tile_id) continue;
    if (!result.has(row.team_id)) result.set(row.team_id, new Set());
    result.get(row.team_id)!.add(row.tile_id);
  }
  return result;
}

/**
 * Loads every registered player's account snapshots (main + side accounts)
 * for a bingo, shaped for the pure engine above. Fixed number of bulk
 * queries regardless of player/side-account count (TEAM-BRIEF.md item 6).
 */
export async function loadEnginePlayers(bingoId: string): Promise<EnginePlayer[]> {
  const [snapshotRows, sideAccountsByPlayer] = await Promise.all([
    getAllPlayerSnapshots(bingoId),
    getAllSideAccounts(bingoId),
  ]);

  const allSideAccountIds = Object.values(sideAccountsByPlayer).flatMap((accounts) =>
    accounts.map((a) => a.id),
  );
  const sideSnapshotsById = await getSideAccountSnapshotsBulk(allSideAccountIds);

  return snapshotRows.map(({ player, start, current }): EnginePlayer => {
    const mainAccount: AccountSnapshots = { start: toSnapshotLike(start), current: toSnapshotLike(current) };
    const sideAccounts: AccountSnapshots[] = (sideAccountsByPlayer[player.id] ?? []).map((sideAccount) => {
      const pair = sideSnapshotsById.get(sideAccount.id);
      return {
        start: toSnapshotLike(pair?.start ?? null),
        current: toSnapshotLike(pair?.current ?? null),
      };
    });
    return { playerId: player.id, teamId: player.team_id, accounts: [mainAccount, ...sideAccounts] };
  });
}

/**
 * The orchestrator every route calls: loads players/snapshots/approved-Drops
 * submissions for `bingoId` and runs the pure engine over `tiles` for
 * `teamIds`. `tiles` and `teamIds` are passed in (rather than re-resolved
 * here) so callers that already fetched the active board/team list — every
 * current call site — don't pay for it twice.
 */
export async function computeBingoCompletion(
  bingoId: string,
  tiles: EngineTile[],
  teamIds: string[],
): Promise<CompletionResult> {
  const dropsTileIds = tiles.filter((t) => t.type === "Drops").map((t) => t.id);

  const [players, approvedDropsTileIdsByTeam] = await Promise.all([
    loadEnginePlayers(bingoId),
    getApprovedDropsTileIdsByTeam(bingoId, dropsTileIds),
  ]);

  return computeCompletion(tiles, players, teamIds, approvedDropsTileIdsByTeam);
}
