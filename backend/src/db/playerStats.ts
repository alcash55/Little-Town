import { getDb } from "./client.js";
import { getAllSideAccounts } from "./players.js";
import { getUnresolvedRsnChangesByPlayer } from "./rsnChangeLog.js";
import {
  computeBingoCompletion,
  type EngineTile,
  type UnresolvableTile,
} from "../services/completionEngine.js";

// -------------------------------------------------------
// Types (contract 3, TEAM-BRIEF.md)
// -------------------------------------------------------

export interface PlayerStat {
  rsn: string;
  teamName: string; // '' if unassigned
  // Distinct Drops tiles with an approved submission attributed via
  // player_id (TEAM-BRIEF.md Sprint 13, Track A item 3): under the new
  // hiscores-auto-verify model, Kill Count/Experience tiles are TEAM-level
  // achievements computed entirely by services/completionEngine.ts and
  // never read player_id at all, so they can never contribute here — only
  // an admin-attributed Drops approval can. A player who single-handedly
  // pushed their team over a Kill Count target shows 0 here; that's
  // expected, not a bug (their contribution shows up in the team's
  // tilesCompleted via GET /api/admin/bingo/team-stats instead).
  tilesCompleted: number;
  totalPoints: number; // sum of those tiles' points
  lastSeen: string | null; // ISO: latest approved submission (fallback: latest snapshot) for the player
  sideAccounts: string[];
  // RSN change detection (Track A item 1, TEAM-BRIEF.md): true when the
  // player's on-file RSN currently has an unresolved rsn_change_log entry
  // (most recent hiscore lookup for it 404'd). rsnStaleSince is that entry's
  // detected_at, or null when rsnStale is false.
  rsnStale: boolean;
  rsnStaleSince: string | null;
}

/**
 * Per-player bingo stats for the admin overview page. Aggregates in-memory
 * over a fixed number of bulk queries (players, teams, tiles, approved
 * submissions, snapshots, side accounts) — no per-player round trips.
 *
 * Requires `bingo_submissions.player_id` (contract 1). Throws a Postgres
 * "column does not exist" (42703) error until that migration lands; callers
 * writing tests against this should skipIf the column is absent.
 */
export async function getPlayerStats(bingoId: string): Promise<PlayerStat[]> {
  const db = getDb();

  const [playersRes, teamsRes, tilesRes] = await Promise.all([
    db.from("bingo_players").select("id, rsn, team_id").eq("bingo_id", bingoId),
    db.from("bingo_teams").select("id, name").eq("bingo_id", bingoId),
    db.from("bingo_board_tiles").select("id, type, points").eq("bingo_id", bingoId),
  ]);

  if (playersRes.error) throw new Error(`Failed to get players: ${playersRes.error.message}`);
  if (teamsRes.error) throw new Error(`Failed to get teams: ${teamsRes.error.message}`);
  if (tilesRes.error) throw new Error(`Failed to get tiles: ${tilesRes.error.message}`);

  const playerRows = (playersRes.data ?? []) as Array<{
    id: string;
    rsn: string;
    team_id: string | null;
  }>;
  if (!playerRows.length) return [];

  const teamNameById = new Map(
    ((teamsRes.data ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]),
  );
  const tileRows = (tilesRes.data ?? []) as Array<{ id: string; type: string; points: number }>;
  const tilePointsById = new Map(tileRows.map((t) => [t.id, t.points]));
  // Player-level attribution only ever matters for Drops tiles now (item 3)
  // — a submission sitting on a Kill Count/Experience tile (legacy or
  // otherwise) is scoring-irrelevant at the player level.
  const dropsTileIds = new Set(tileRows.filter((t) => t.type === "Drops").map((t) => t.id));

  const playerIds = playerRows.map((p) => p.id);

  const [submissionsRes, snapshotsRes, sideAccountsByPlayer, unresolvedRsnChanges] = await Promise.all([
    db
      .from("bingo_submissions")
      .select("player_id, tile_id, created_at")
      .eq("bingo_id", bingoId)
      .eq("status", "approved")
      // .in() below already implies player_id IS NOT NULL, but stated
      // explicitly so this query's predicate matches
      // bingo_submissions_player_approved_idx (status='approved' AND
      // player_id IS NOT NULL) exactly — see data-engineer's cross-role
      // note (Story 1, contract 3 lastSeen uses created_at, not
      // reviewed_at, for the same reason).
      .not("player_id", "is", null)
      .in("player_id", playerIds),
    db
      .from("bingo_player_hiscores")
      .select("player_id, taken_at")
      .in("player_id", playerIds)
      .is("side_account_id", null),
    getAllSideAccounts(bingoId),
    getUnresolvedRsnChangesByPlayer(playerIds),
  ]);

  if (submissionsRes.error) {
    throw new Error(`Failed to get approved submissions: ${submissionsRes.error.message}`);
  }
  if (snapshotsRes.error) throw new Error(`Failed to get snapshots: ${snapshotsRes.error.message}`);

  // Distinct tiles + latest approved-submission timestamp per player.
  const tilesByPlayer = new Map<string, Set<string>>();
  const lastSubmissionByPlayer = new Map<string, string>();
  for (const sub of (submissionsRes.data ?? []) as Array<{
    player_id: string | null;
    tile_id: string | null;
    created_at: string;
  }>) {
    if (!sub.player_id || !sub.tile_id) continue;
    if (!dropsTileIds.has(sub.tile_id)) continue; // Kill Count/Experience — scoring-irrelevant per-player (item 3)
    if (!tilesByPlayer.has(sub.player_id)) tilesByPlayer.set(sub.player_id, new Set());
    tilesByPlayer.get(sub.player_id)!.add(sub.tile_id);

    const existing = lastSubmissionByPlayer.get(sub.player_id);
    if (!existing || sub.created_at > existing) lastSubmissionByPlayer.set(sub.player_id, sub.created_at);
  }

  // Latest snapshot timestamp per player (start or current — whichever is newer).
  const lastSnapshotByPlayer = new Map<string, string>();
  for (const snap of (snapshotsRes.data ?? []) as Array<{ player_id: string; taken_at: string }>) {
    const existing = lastSnapshotByPlayer.get(snap.player_id);
    if (!existing || snap.taken_at > existing) lastSnapshotByPlayer.set(snap.player_id, snap.taken_at);
  }

  return playerRows.map((player): PlayerStat => {
    const tileSet = tilesByPlayer.get(player.id) ?? new Set<string>();
    const totalPoints = Array.from(tileSet).reduce(
      (sum, tileId) => sum + (tilePointsById.get(tileId) ?? 0),
      0,
    );

    const rsnStaleSince = unresolvedRsnChanges.get(player.id) ?? null;

    return {
      rsn: player.rsn,
      teamName: player.team_id ? (teamNameById.get(player.team_id) ?? "") : "",
      tilesCompleted: tileSet.size,
      totalPoints,
      lastSeen: lastSubmissionByPlayer.get(player.id) ?? lastSnapshotByPlayer.get(player.id) ?? null,
      sideAccounts: (sideAccountsByPlayer[player.id] ?? []).map((sa) => sa.rsn),
      rsnStale: rsnStaleSince !== null,
      rsnStaleSince,
    };
  });
}

// -------------------------------------------------------
// Team-level stats — now engine-computed (TEAM-BRIEF.md Sprint 13, Track A)
// -------------------------------------------------------

export interface TeamStat {
  teamId: string;
  teamName: string;
  // Distinct tiles counted complete for this team by
  // services/completionEngine.ts: auto-verified Kill Count/Experience tiles
  // (team-summed hiscore deltas >= target_value) PLUS Drops tiles with >=1
  // APPROVED submission for this team — each tile counted at most once,
  // regardless of player_id. This is the same set GET /api/bingo/board's
  // completedByMyTeam is drawn from for the caller's own team.
  tilesCompleted: number;
  totalPoints: number;
  // Of the above, DROPS tiles only, where EVERY approved submission is
  // missing player_id — i.e. the team demonstrably completed the tile, but
  // no player-level stat anywhere reflects it (playerStats' tilesByPlayer
  // only counts Drops submissions WITH player_id). Kill Count/Experience
  // tiles never appear here (item 3 — they're team-level achievements,
  // attribution is meaningless for them under the new model). Root cause of
  // a Drops gap: player_id is an optional admin-filled field at approval
  // time — routes/admin.ts's POST /bingo/screenshots/:id/approve now
  // REQUIRES it for NEW approvals (contract 3), but older rows can still
  // predate that.
  unattributedTiles: number;
  unattributedPoints: number;
}

/**
 * Team-level completion + the engine's unresolvable-tile list in one pass
 * (both need the same tiles/players/submissions data, so this runs the
 * engine exactly once). `unattributedTiles`/`unattributedPoints` are
 * computed alongside from a second, Drops-scoped submissions query — the
 * engine itself doesn't track attribution (that's a Drops-only, player-
 * level concern, not part of "is this tile complete").
 */
export async function getTeamStatsWithUnresolvable(
  bingoId: string,
): Promise<{ teams: TeamStat[]; unresolvableTiles: UnresolvableTile[] }> {
  const db = getDb();

  const [teamsRes, tilesRes] = await Promise.all([
    db.from("bingo_teams").select("id, name").eq("bingo_id", bingoId),
    db.from("bingo_board_tiles").select("id, task, type, points, target_value").eq("bingo_id", bingoId),
  ]);

  if (teamsRes.error) throw new Error(`Failed to get teams: ${teamsRes.error.message}`);
  if (tilesRes.error) throw new Error(`Failed to get tiles: ${tilesRes.error.message}`);

  const teamRows = (teamsRes.data ?? []) as Array<{ id: string; name: string }>;
  if (!teamRows.length) return { teams: [], unresolvableTiles: [] };

  const tileRows = (tilesRes.data ?? []) as Array<{
    id: string;
    task: string;
    type: "Kill Count" | "Experience" | "Drops";
    points: number;
    target_value: number | null;
  }>;
  const tilePointsById = new Map(tileRows.map((t) => [t.id, t.points]));
  const dropsTileIds = tileRows.filter((t) => t.type === "Drops").map((t) => t.id);

  const engineTiles: EngineTile[] = tileRows.map((t) => ({
    id: t.id,
    task: t.task,
    type: t.type,
    points: t.points,
    targetValue: t.target_value,
  }));
  const teamIds = teamRows.map((t) => t.id);

  const [{ completedTileIdsByTeam, totalPointsByTeam, unresolvableTiles }, dropsSubmissionsRes] =
    await Promise.all([
      computeBingoCompletion(bingoId, engineTiles, teamIds),
      dropsTileIds.length
        ? db
            .from("bingo_submissions")
            .select("team_id, tile_id, player_id")
            .eq("bingo_id", bingoId)
            .eq("status", "approved")
            .in("tile_id", dropsTileIds)
            .not("team_id", "is", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (dropsSubmissionsRes.error) {
    throw new Error(`Failed to get approved drop submissions: ${dropsSubmissionsRes.error.message}`);
  }

  // teamId -> tileId -> "has at least one approved Drops submission WITH player_id"
  const dropsAttributionByTeam = new Map<string, Map<string, boolean>>();
  for (const sub of (dropsSubmissionsRes.data ?? []) as Array<{
    team_id: string | null;
    tile_id: string | null;
    player_id: string | null;
  }>) {
    if (!sub.team_id || !sub.tile_id) continue;
    let teamTiles = dropsAttributionByTeam.get(sub.team_id);
    if (!teamTiles) {
      teamTiles = new Map();
      dropsAttributionByTeam.set(sub.team_id, teamTiles);
    }
    teamTiles.set(sub.tile_id, (teamTiles.get(sub.tile_id) ?? false) || sub.player_id !== null);
  }

  const teams = teamRows.map((team): TeamStat => {
    const completedTiles = completedTileIdsByTeam.get(team.id) ?? new Set<string>();
    const attributionMap = dropsAttributionByTeam.get(team.id) ?? new Map<string, boolean>();

    let unattributedTiles = 0;
    let unattributedPoints = 0;
    for (const [tileId, attributed] of attributionMap) {
      if (!completedTiles.has(tileId) || attributed) continue;
      unattributedTiles += 1;
      unattributedPoints += tilePointsById.get(tileId) ?? 0;
    }

    return {
      teamId: team.id,
      teamName: team.name,
      tilesCompleted: completedTiles.size,
      totalPoints: totalPointsByTeam.get(team.id) ?? 0,
      unattributedTiles,
      unattributedPoints,
    };
  });

  return { teams, unresolvableTiles };
}

/** Thin wrapper over getTeamStatsWithUnresolvable for callers that only need the per-team array. */
export async function getTeamStats(bingoId: string): Promise<TeamStat[]> {
  return (await getTeamStatsWithUnresolvable(bingoId)).teams;
}
