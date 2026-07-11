import { getDb } from "./client.js";

export type RsnChangeSource = "cron" | "drafter";

export interface RsnChangeLogRow {
  id: string;
  player_id: string;
  old_rsn: string;
  detected_at: string;
  source: RsnChangeSource;
  resolved_at: string | null;
}

/**
 * Records that `rsn` stopped resolving on the OSRS hiscores for `playerId`,
 * unless an unresolved entry already exists for that player (avoids
 * re-logging every cron tick while the same RSN stays broken).
 *
 * A DB-level partial unique index (uq_rsn_change_log_unresolved_per_player,
 * see 20260711000000_rsn_change_log.sql) backstops the check-then-insert
 * race between concurrent callers; a 23505 from a concurrent insert winning
 * that race is treated as "already logged", not an error.
 */
export async function logRsnChange(
  playerId: string,
  oldRsn: string,
  source: RsnChangeSource,
): Promise<void> {
  const db = getDb();

  const { data: existing, error: selectError } = await db
    .from("rsn_change_log")
    .select("id")
    .eq("player_id", playerId)
    .is("resolved_at", null)
    .maybeSingle();

  if (selectError) throw new Error(`Failed to check rsn_change_log: ${selectError.message}`);
  if (existing) return;

  const { error: insertError } = await db
    .from("rsn_change_log")
    .insert({ player_id: playerId, old_rsn: oldRsn, source });

  if (insertError && insertError.code !== "23505") {
    throw new Error(`Failed to log RSN change for "${oldRsn}": ${insertError.message}`);
  }
}

/**
 * Marks any unresolved rsn_change_log entry for a player as resolved —
 * called when a hiscore lookup for that player's on-file RSN succeeds again.
 * Purely clears the stale flag; never touches bingo_players.rsn.
 */
export async function resolveRsnChange(playerId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("rsn_change_log")
    .update({ resolved_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .is("resolved_at", null);

  if (error) {
    throw new Error(`Failed to resolve rsn_change_log for player ${playerId}: ${error.message}`);
  }
}

/**
 * Bulk-fetch unresolved-entry detected_at for a set of players — backs the
 * player-stats payload's rsnStale / rsnStaleSince fields (contract 3,
 * TEAM-BRIEF.md Track A item 1). Returns a Map of player_id -> detected_at
 * for players that currently have an unresolved entry; absence means
 * rsnStale: false.
 */
export async function getUnresolvedRsnChangesByPlayer(
  playerIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!playerIds.length) return result;

  const db = getDb();
  const { data, error } = await db
    .from("rsn_change_log")
    .select("player_id, detected_at")
    .in("player_id", playerIds)
    .is("resolved_at", null);

  if (error) throw new Error(`Failed to get unresolved RSN changes: ${error.message}`);

  for (const row of (data ?? []) as Array<{ player_id: string; detected_at: string }>) {
    result.set(row.player_id, row.detected_at);
  }
  return result;
}
