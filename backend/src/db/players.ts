import { getDb } from "./client.js";
import { HiscoreData, SideAccount } from "../types/index.js";
import { AppError } from "../middleware/errorHandler.js";

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface BingoPlayer {
  id: string;
  bingo_id: string;
  team_id: string | null;
  captain_team_id: string | null;
  rsn: string;
  registered_by: string | null;
  registered_at: string;
}

export interface PlayerSnapshot {
  id: string;
  player_id: string;
  type: "start" | "current";
  skills: HiscoreData["skills"];
  activities: HiscoreData["activities"];
  taken_at: string;
}

// -------------------------------------------------------
// Player registration
// -------------------------------------------------------

/**
 * Register a player to a bingo. Returns the existing row if already registered.
 */
export async function registerBingoPlayer(
  bingoId: string,
  rsn: string,
  teamId?: string,
  registeredBy?: string,
): Promise<BingoPlayer> {
  const db = getDb();

  // Insert-if-absent (ignoreDuplicates), then always read back whichever row
  // exists. Re-registering an already-registered RSN must be a race-free
  // no-op — a merge-duplicates upsert would null out an existing team_id/
  // registered_by on every re-add (e.g. re-importing the same CSV).
  const { error: insertError } = await db.from("bingo_players").upsert(
    { bingo_id: bingoId, rsn, team_id: teamId ?? null, registered_by: registeredBy ?? null },
    { onConflict: "bingo_id,rsn", ignoreDuplicates: true },
  );

  if (insertError) throw new Error(`Failed to register player "${rsn}": ${insertError.message}`);

  const { data, error } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .single();

  if (error || !data) throw new Error(`Failed to register player "${rsn}": ${error?.message}`);
  return data as BingoPlayer;
}

/**
 * Get all players registered to a bingo.
 */
export async function getBingoPlayers(bingoId: string): Promise<BingoPlayer[]> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .order("registered_at", { ascending: true });

  if (error) throw new Error(`Failed to get players: ${error.message}`);
  return (data ?? []) as BingoPlayer[];
}

/**
 * Get a single player by RSN within a bingo.
 */
export async function getBingoPlayer(bingoId: string, rsn: string): Promise<BingoPlayer | null> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .maybeSingle();

  if (error) throw new Error(`Failed to get player: ${error.message}`);
  return data as BingoPlayer | null;
}

/**
 * Remove a player from a bingo (cascades snapshots and side accounts).
 */
export async function removeBingoPlayer(bingoId: string, rsn: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("bingo_players")
    .delete()
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn);

  if (error) throw new Error(`Failed to remove player "${rsn}": ${error.message}`);
}

/**
 * Update a player's team assignment.
 */
export async function updatePlayerTeam(
  bingoId: string,
  rsn: string,
  teamId: string | null,
): Promise<BingoPlayer> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_players")
    .update({ team_id: teamId })
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to update team for "${rsn}": ${error?.message}`);
  return data as BingoPlayer;
}

/**
 * Set or clear a player's team captain role. Only one captain per team per bingo.
 * Delegates to the set_team_captain RPC, which atomically clears the team's
 * existing captain and sets the new one (avoiding the clear-then-set race).
 */
export async function updatePlayerCaptain(
  bingoId: string,
  rsn: string,
  captainTeamId: string | null,
): Promise<BingoPlayer> {
  const db = getDb();

  const { data, error } = await db.rpc("set_team_captain", {
    p_bingo_id: bingoId,
    p_rsn: rsn,
    p_captain_team_id: captainTeamId,
  });

  if (error) {
    // set_team_captain raises 'Player "..." not found in this bingo' /
    // 'Captain team not found for this bingo' — surface those as 404s
    // instead of letting them fall through to a generic 500.
    if (/not found/i.test(error.message)) {
      throw new AppError(error.message, 404);
    }
    throw new Error(`Failed to update captain for "${rsn}": ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new AppError(`Player "${rsn}" not found in this bingo`, 404);
  return row as BingoPlayer;
}

/**
 * Reset all player team assignments for a bingo (set team_id = NULL).
 */
export async function resetPlayerTeams(bingoId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("bingo_players")
    .update({ team_id: null })
    .eq("bingo_id", bingoId);

  if (error) throw new Error(`Failed to reset teams: ${error.message}`);
}

// -------------------------------------------------------
// Snapshots
// -------------------------------------------------------

/**
 * Save a snapshot for a player.
 * - 'start': only written once; subsequent calls are ignored.
 * - 'current': upserted every time.
 *
 * Delegates to the upsert_player_hiscore_start / upsert_player_hiscore_current
 * RPCs (see 20260709000000_snapshot_upsert_rpc.sql) instead of PostgREST's
 * .upsert(): bingo_player_hiscores' real arbiters, uq_hiscores_primary and
 * uq_hiscores_side, are PARTIAL unique indexes, and PostgREST's onConflict
 * option can only emit a bare column list, never the WHERE predicate needed
 * to infer a partial index. The RPCs pick the correct arbiter in SQL. This
 * function always targets the primary-account row (p_side_account_id null)
 * — side-account snapshot writes are DB-storable as of that migration but
 * have no caller yet this sprint.
 */
export async function savePlayerSnapshot(
  playerId: string,
  type: "start" | "current",
  data: HiscoreData,
): Promise<PlayerSnapshot> {
  const db = getDb();

  const rpcName = type === "start" ? "upsert_player_hiscore_start" : "upsert_player_hiscore_current";

  const { data: saved, error } = await db.rpc(rpcName, {
    p_player_id: playerId,
    p_side_account_id: null,
    p_skills: data.skills,
    p_activities: data.activities,
    p_taken_at: new Date().toISOString(),
  });

  if (error || !saved) throw new Error(`Failed to save ${type} snapshot: ${error?.message}`);
  return saved as PlayerSnapshot;
}

/**
 * Get both snapshots for a player. Returns null for any that don't exist yet.
 */
export async function getPlayerSnapshots(playerId: string): Promise<{
  start: PlayerSnapshot | null;
  current: PlayerSnapshot | null;
}> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_player_hiscores")
    .select("*")
    .eq("player_id", playerId)
    .is("side_account_id", null);

  if (error) throw new Error(`Failed to get snapshots: ${error.message}`);

  const rows = (data ?? []) as PlayerSnapshot[];
  return {
    start: rows.find((r) => r.type === "start") ?? null,
    current: rows.find((r) => r.type === "current") ?? null,
  };
}

/**
 * Get snapshots for all players in a bingo in one query.
 */
export async function getAllPlayerSnapshots(bingoId: string): Promise<
  Array<{
    player: BingoPlayer;
    start: PlayerSnapshot | null;
    current: PlayerSnapshot | null;
  }>
> {
  const db = getDb();

  const { data: players, error: pErr } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId);

  if (pErr) throw new Error(`Failed to get players: ${pErr.message}`);
  if (!players?.length) return [];

  const playerIds = players.map((p: BingoPlayer) => p.id);

  const { data: snapshots, error: sErr } = await db
    .from("bingo_player_hiscores")
    .select("*")
    .in("player_id", playerIds)
    .is("side_account_id", null);

  if (sErr) throw new Error(`Failed to get snapshots: ${sErr.message}`);

  const snapshotRows = (snapshots ?? []) as PlayerSnapshot[];

  return players.map((player: BingoPlayer) => ({
    player,
    start: snapshotRows.find((s) => s.player_id === player.id && s.type === "start") ?? null,
    current: snapshotRows.find((s) => s.player_id === player.id && s.type === "current") ?? null,
  }));
}

// -------------------------------------------------------
// Side accounts
// -------------------------------------------------------

/**
 * Get all side accounts for a player.
 */
export async function getSideAccounts(playerId: string): Promise<SideAccount[]> {
  const db = getDb();
  const { data, error } = await db
    .from("bingo_player_side_accounts")
    .select("*")
    .eq("player_id", playerId)
    .order("added_at", { ascending: true });

  if (error) throw new Error(`Failed to get side accounts: ${error.message}`);
  return (data ?? []) as SideAccount[];
}

/**
 * Add a side account to a player. Returns the existing row if the RSN is already tracked.
 */
export async function addSideAccount(
  playerId: string,
  rsn: string,
  notes?: string,
  addedBy?: string,
): Promise<SideAccount> {
  const db = getDb();

  // Insert-if-absent (ignoreDuplicates), then always read back whichever row
  // exists. Re-adding an already-tracked RSN must be a race-free no-op — a
  // merge-duplicates upsert would wipe existing notes/added_by on every
  // re-add.
  const { error: insertError } = await db.from("bingo_player_side_accounts").upsert(
    { player_id: playerId, rsn, notes: notes ?? null, added_by: addedBy ?? null },
    { onConflict: "player_id,rsn", ignoreDuplicates: true },
  );

  if (insertError) throw new Error(`Failed to add side account "${rsn}": ${insertError.message}`);

  const { data, error } = await db
    .from("bingo_player_side_accounts")
    .select("*")
    .eq("player_id", playerId)
    .eq("rsn", rsn)
    .single();

  if (error || !data) throw new Error(`Failed to add side account "${rsn}": ${error?.message}`);
  return data as SideAccount;
}

/**
 * Remove a side account by its ID.
 */
export async function removeSideAccount(sideAccountId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("bingo_player_side_accounts")
    .delete()
    .eq("id", sideAccountId);

  if (error) throw new Error(`Failed to remove side account: ${error.message}`);
}

/**
 * Get all side accounts for every player in a bingo, keyed by player_id.
 */
export async function getAllSideAccounts(
  bingoId: string,
): Promise<Record<string, SideAccount[]>> {
  const db = getDb();

  const { data: players, error: pErr } = await db
    .from("bingo_players")
    .select("id")
    .eq("bingo_id", bingoId);

  if (pErr) throw new Error(`Failed to get players: ${pErr.message}`);
  if (!players?.length) return {};

  const playerIds = players.map((p: { id: string }) => p.id);

  const { data, error } = await db
    .from("bingo_player_side_accounts")
    .select("*")
    .in("player_id", playerIds)
    .order("added_at", { ascending: true });

  if (error) throw new Error(`Failed to get side accounts: ${error.message}`);

  const result: Record<string, SideAccount[]> = {};
  for (const row of (data ?? []) as SideAccount[]) {
    if (!result[row.player_id]) result[row.player_id] = [];
    result[row.player_id].push(row);
  }
  return result;
}
