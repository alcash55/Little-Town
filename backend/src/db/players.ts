import { getDb } from "./client.js";
import { HiscoreData, SideAccount } from "../types/index.js";

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

  const { data: existing } = await db
    .from("bingo_players")
    .select("*")
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .maybeSingle();

  if (existing) return existing as BingoPlayer;

  const { data, error } = await db
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn, team_id: teamId ?? null, registered_by: registeredBy ?? null })
    .select()
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
 */
export async function updatePlayerCaptain(
  bingoId: string,
  rsn: string,
  captainTeamId: string | null,
): Promise<BingoPlayer> {
  const db = getDb();

  if (captainTeamId) {
    const { data: team, error: teamErr } = await db
      .from("bingo_teams")
      .select("id")
      .eq("id", captainTeamId)
      .eq("bingo_id", bingoId)
      .maybeSingle();

    if (teamErr) throw new Error(`Failed to validate team: ${teamErr.message}`);
    if (!team) throw new Error("Captain team not found for this bingo");

    const { error: clearErr } = await db
      .from("bingo_players")
      .update({ captain_team_id: null })
      .eq("bingo_id", bingoId)
      .eq("captain_team_id", captainTeamId);

    if (clearErr) throw new Error(`Failed to clear existing captain: ${clearErr.message}`);
  }

  const { data, error } = await db
    .from("bingo_players")
    .update({ captain_team_id: captainTeamId })
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to update captain for "${rsn}": ${error?.message}`);
  return data as BingoPlayer;
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
 */
export async function savePlayerSnapshot(
  playerId: string,
  type: "start" | "current",
  data: HiscoreData,
): Promise<PlayerSnapshot> {
  const db = getDb();

  // Never overwrite a start snapshot
  if (type === "start") {
    const { data: existing } = await db
      .from("bingo_player_hiscores")
      .select("*")
      .eq("player_id", playerId)
      .eq("type", "start")
      .is("side_account_id", null)
      .maybeSingle();

    if (existing) return existing as PlayerSnapshot;
  }

  const payload = {
    player_id: playerId,
    type,
    skills: data.skills,
    activities: data.activities,
    taken_at: new Date().toISOString(),
    side_account_id: null,
  };

  const { data: saved, error } = await db
    .from("bingo_player_hiscores")
    .upsert(payload, { onConflict: "player_id,type" })
    .select()
    .single();

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

  const { data: existing } = await db
    .from("bingo_player_side_accounts")
    .select("*")
    .eq("player_id", playerId)
    .eq("rsn", rsn)
    .maybeSingle();

  if (existing) return existing as SideAccount;

  const { data, error } = await db
    .from("bingo_player_side_accounts")
    .insert({ player_id: playerId, rsn, notes: notes ?? null, added_by: addedBy ?? null })
    .select()
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
