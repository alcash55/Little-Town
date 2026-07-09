import { getDb } from "./client.js";
import { getAllSideAccounts } from "./players.js";

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

  const [submissionsRes, snapshotsRes, sideAccountsByPlayer] = await Promise.all([
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

    return {
      rsn: player.rsn,
      teamName: player.team_id ? (teamNameById.get(player.team_id) ?? "") : "",
      tilesCompleted: tileSet.size,
      totalPoints,
      lastSeen: lastSubmissionByPlayer.get(player.id) ?? lastSnapshotByPlayer.get(player.id) ?? null,
      sideAccounts: (sideAccountsByPlayer[player.id] ?? []).map((sa) => sa.rsn),
    };
  });
}
