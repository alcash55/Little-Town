import { getDb } from "./client.js";
import { HiscoreData } from "../types/index.js";

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface BingoPlayer {
  id: string;
  bingo_id: string;
  team_id: string | null;
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
 * Remove a player from a bingo (cascades snapshots).
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
      .maybeSingle();

    if (existing) return existing as PlayerSnapshot;
  }

  const payload = {
    player_id: playerId,
    type,
    skills: data.skills,
    activities: data.activities,
    taken_at: new Date().toISOString(),
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
    .eq("player_id", playerId);

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
    .in("player_id", playerIds);

  if (sErr) throw new Error(`Failed to get snapshots: ${sErr.message}`);

  const snapshotRows = (snapshots ?? []) as PlayerSnapshot[];

  return players.map((player: BingoPlayer) => ({
    player,
    start: snapshotRows.find((s) => s.player_id === player.id && s.type === "start") ?? null,
    current: snapshotRows.find((s) => s.player_id === player.id && s.type === "current") ?? null,
  }));
}
