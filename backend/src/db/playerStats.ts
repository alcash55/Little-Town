import { getDb } from "./client.js";
import { getAllSideAccounts } from "./players.js";
import { getUnresolvedRsnChangesByPlayer } from "./rsnChangeLog.js";

// -------------------------------------------------------
// Types (contract 3, TEAM-BRIEF.md)
// -------------------------------------------------------

export interface PlayerStat {
  rsn: string;
  teamName: string; // '' if unassigned
  tilesCompleted: number; // distinct tiles with an approved submission attributed via player_id
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
    db.from("bingo_board_tiles").select("id, points").eq("bingo_id", bingoId),
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
  const tilePointsById = new Map(
    ((tilesRes.data ?? []) as Array<{ id: string; points: number }>).map((t) => [t.id, t.points]),
  );

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
// Team-level stats (attribution-independent ground truth)
// -------------------------------------------------------

export interface TeamStat {
  teamId: string;
  teamName: string;
  // Distinct tiles with >=1 APPROVED submission for this team — counted
  // regardless of player_id, unlike PlayerStat.tilesCompleted above. This is
  // the same "did the team complete this tile" signal GET /api/bingo/board
  // uses for completedByMyTeam (team_id-scoped, no player_id involved).
  tilesCompleted: number;
  totalPoints: number;
  // Of the above, tiles where EVERY approved submission is missing
  // player_id — i.e. the team demonstrably completed the tile, but no
  // player-level stat anywhere reflects it (playerStats' tilesByPlayer only
  // counts submissions WITH player_id). Surfaces the attribution gap
  // instead of letting real progress silently vanish from the per-player
  // table (root cause: player_id is an optional admin-filled field at
  // approval time — routes/admin.ts's POST /bingo/screenshots/:id/approve,
  // frontend ScreenshotCard's "Player (optional)" picker, defaults to
  // unassigned).
  unattributedTiles: number;
  unattributedPoints: number;
}

/**
 * Team-level completion, computed straight from approved submissions'
 * team_id (never player_id). Exists specifically as a degrade-gracefully
 * fallback for the attribution gap above: BingoOverview's player-level table
 * can under-report a team's real progress when approvals weren't attributed
 * to a specific player, but a team's OWN total is always accurate here — it
 * doesn't depend on player_id at all. Pairs with getPlayerStats(); GET
 * /api/admin/bingo/team-stats exposes this separately rather than folding it
 * into PlayerStat[] (an additive, non-breaking sibling endpoint).
 */
export async function getTeamStats(bingoId: string): Promise<TeamStat[]> {
  const db = getDb();

  const [teamsRes, tilesRes, submissionsRes] = await Promise.all([
    db.from("bingo_teams").select("id, name").eq("bingo_id", bingoId),
    db.from("bingo_board_tiles").select("id, points").eq("bingo_id", bingoId),
    db
      .from("bingo_submissions")
      .select("team_id, tile_id, player_id")
      .eq("bingo_id", bingoId)
      .eq("status", "approved")
      .not("team_id", "is", null)
      .not("tile_id", "is", null),
  ]);

  if (teamsRes.error) throw new Error(`Failed to get teams: ${teamsRes.error.message}`);
  if (tilesRes.error) throw new Error(`Failed to get tiles: ${tilesRes.error.message}`);
  if (submissionsRes.error) {
    throw new Error(`Failed to get approved submissions: ${submissionsRes.error.message}`);
  }

  const teamRows = (teamsRes.data ?? []) as Array<{ id: string; name: string }>;
  const tilePointsById = new Map(
    ((tilesRes.data ?? []) as Array<{ id: string; points: number }>).map((t) => [t.id, t.points]),
  );

  // teamId -> tileId -> "has at least one approved submission WITH player_id"
  const tilesByTeam = new Map<string, Map<string, boolean>>();
  for (const sub of (submissionsRes.data ?? []) as Array<{
    team_id: string | null;
    tile_id: string | null;
    player_id: string | null;
  }>) {
    if (!sub.team_id || !sub.tile_id) continue;
    let teamTiles = tilesByTeam.get(sub.team_id);
    if (!teamTiles) {
      teamTiles = new Map();
      tilesByTeam.set(sub.team_id, teamTiles);
    }
    teamTiles.set(sub.tile_id, (teamTiles.get(sub.tile_id) ?? false) || sub.player_id !== null);
  }

  return teamRows.map((team): TeamStat => {
    const tileMap = tilesByTeam.get(team.id) ?? new Map<string, boolean>();
    let totalPoints = 0;
    let unattributedTiles = 0;
    let unattributedPoints = 0;
    for (const [tileId, attributed] of tileMap) {
      const points = tilePointsById.get(tileId) ?? 0;
      totalPoints += points;
      if (!attributed) {
        unattributedTiles += 1;
        unattributedPoints += points;
      }
    }
    return {
      teamId: team.id,
      teamName: team.name,
      tilesCompleted: tileMap.size,
      totalPoints,
      unattributedTiles,
      unattributedPoints,
    };
  });
}
