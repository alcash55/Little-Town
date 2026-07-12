import { getDb } from "./client.js";

export type RsnChangeSource = "cron" | "drafter";
export type RsnChangeResolution = "auto_wom" | "manual";

export interface RsnChangeLogRow {
  id: string;
  player_id: string | null;
  side_account_id: string | null;
  old_rsn: string;
  new_rsn: string | null;
  detected_at: string;
  source: RsnChangeSource;
  resolved_at: string | null;
  resolution: RsnChangeResolution | null;
}

type RsnChangeTargetColumn = "player_id" | "side_account_id";

/**
 * Records that `rsn` stopped resolving on the OSRS hiscores for the given
 * player or side account (exactly one of `player_id`/`side_account_id` is
 * ever set — see the XOR check added by 20260712000000_rsn_change_log_wom
 * .sql), unless an unresolved entry already exists for that subject (avoids
 * re-logging every cron tick while the same RSN stays broken). Returns the
 * existing or newly-created row either way, so callers (checkRsnChange) can
 * later resolve that exact row if a Wise Old Man rename confirms it.
 *
 * A DB-level partial unique index per subject
 * (uq_rsn_change_log_unresolved_per_player /
 * _per_side_account) backstops the check-then-insert race between
 * concurrent callers; a 23505 from a concurrent insert winning that race is
 * treated as "already logged", not an error — we just read back the winner.
 */
async function logRsnChangeInternal(
  column: RsnChangeTargetColumn,
  id: string,
  oldRsn: string,
  source: RsnChangeSource,
): Promise<RsnChangeLogRow> {
  const db = getDb();

  const { data: existing, error: selectError } = await db
    .from("rsn_change_log")
    .select("*")
    .eq(column, id)
    .is("resolved_at", null)
    .maybeSingle();

  if (selectError) throw new Error(`Failed to check rsn_change_log: ${selectError.message}`);
  if (existing) return existing as RsnChangeLogRow;

  const { data: inserted, error: insertError } = await db
    .from("rsn_change_log")
    .insert({ [column]: id, old_rsn: oldRsn, source })
    .select("*")
    .single();

  if (insertError && insertError.code !== "23505") {
    throw new Error(`Failed to log RSN change for "${oldRsn}": ${insertError.message}`);
  }
  if (inserted) return inserted as RsnChangeLogRow;

  // Lost the insert race to a concurrent caller — read back the winner.
  const { data: winner, error: reselectError } = await db
    .from("rsn_change_log")
    .select("*")
    .eq(column, id)
    .is("resolved_at", null)
    .maybeSingle();

  if (reselectError || !winner) {
    throw new Error(
      `Failed to log RSN change for "${oldRsn}": lost the insert race and re-select failed ` +
        `(${reselectError?.message ?? "no unresolved row found"})`,
    );
  }
  return winner as RsnChangeLogRow;
}

export function logRsnChange(
  playerId: string,
  oldRsn: string,
  source: RsnChangeSource,
): Promise<RsnChangeLogRow> {
  return logRsnChangeInternal("player_id", playerId, oldRsn, source);
}

export function logSideAccountRsnChange(
  sideAccountId: string,
  oldRsn: string,
  source: RsnChangeSource,
): Promise<RsnChangeLogRow> {
  return logRsnChangeInternal("side_account_id", sideAccountId, oldRsn, source);
}

async function resolveRsnChangeInternal(column: RsnChangeTargetColumn, id: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("rsn_change_log")
    .update({ resolved_at: new Date().toISOString() })
    .eq(column, id)
    .is("resolved_at", null);

  if (error) {
    throw new Error(`Failed to resolve rsn_change_log for ${column} ${id}: ${error.message}`);
  }
}

/**
 * Marks any unresolved rsn_change_log entry for a player as resolved —
 * called when a hiscore lookup for that player's on-file RSN succeeds again.
 * Purely clears the stale flag; never touches bingo_players.rsn.
 * `resolution`/`new_rsn` are left NULL — this is "it started resolving
 * again on its own", not an auto-rename (see resolveRsnChangeAutoRename).
 */
export function resolveRsnChange(playerId: string): Promise<void> {
  return resolveRsnChangeInternal("player_id", playerId);
}

/** Side-account counterpart of resolveRsnChange. */
export function resolveSideAccountRsnChange(sideAccountId: string): Promise<void> {
  return resolveRsnChangeInternal("side_account_id", sideAccountId);
}

/**
 * Marks a specific rsn_change_log row resolved via a confirmed Wise Old Man
 * rename (services/rsnChangeDetection.ts) — records the new RSN and
 * resolution: 'auto_wom'. Takes the row's own id (from logRsnChange /
 * logSideAccountRsnChange) rather than a player/side-account id, so it only
 * ever touches the exact row the caller just looked up. The `.is` guard
 * makes a concurrent double-resolve a harmless no-op rather than clobbering
 * a resolution written by a racing call.
 */
export async function resolveRsnChangeAutoRename(rowId: string, newRsn: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("rsn_change_log")
    .update({ resolved_at: new Date().toISOString(), new_rsn: newRsn, resolution: "auto_wom" })
    .eq("id", rowId)
    .is("resolved_at", null);

  if (error) {
    throw new Error(`Failed to auto-resolve rsn_change_log row ${rowId}: ${error.message}`);
  }
}

/**
 * Bulk-fetch unresolved-entry detected_at for a set of players — backs the
 * player-stats payload's rsnStale / rsnStaleSince fields (contract 3,
 * TEAM-BRIEF.md Track A item 1). Returns a Map of player_id -> detected_at
 * for players that currently have an unresolved entry; absence means
 * rsnStale: false. Side-account rows (player_id IS NULL) never match the
 * .in("player_id", ...) filter, so they can't leak into a player's flag.
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
