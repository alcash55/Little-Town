import { getDb } from "./client.js";
import { BingoConfig, BingoStatus } from "../types/index.js";

type Tile = Record<string, unknown> & {
  type: "Kill Count" | "Experience" | "Drops";
  task: string;
  points: number;
};

const BINGO_WITH_TEAMS_SELECT =
  "*, bingo_teams(id, name, created_at), bingo_board_tiles(task)";

function mapBingo(row: Record<string, any>): BingoConfig {
  const teamRows: { id: string; name: string }[] = row.bingo_teams ?? [];
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    boardSize: row.board_size,
    numberOfTeams: teamRows.length,
    teams: teamRows.map((team) => team.name),
    teamObjects: teamRows.map((team, index) => ({
      id: team.id,
      name: team.name,
      sortOrder: index,
    })),
    tasks: row.bingo_board_tiles?.map((tile: { task: string }) => tile.task) ?? [],
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bingoWithTeamsQuery() {
  return getDb()
    .from("bingos")
    .select(BINGO_WITH_TEAMS_SELECT)
    .order("created_at", { referencedTable: "bingo_teams", ascending: true });
}

export async function listBingos(): Promise<BingoConfig[]> {
  const { data, error } = await bingoWithTeamsQuery().order("created_at", {
    ascending: false,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBingo(row));
}

export async function getActiveBingo(): Promise<BingoConfig | null> {
  const { data, error } = await bingoWithTeamsQuery()
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapBingo(data) : null;
}

/** Look up a bingo by its explicit id, regardless of status. */
export async function getBingoById(id: string): Promise<BingoConfig | null> {
  const { data, error } = await bingoWithTeamsQuery().eq("id", id).maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapBingo(data) : null;
}

export async function saveBingoDetails(input: {
  name: string;
  start?: string;
  end?: string;
  size?: number;
  teams?: string[];
  createdBy?: string;
}): Promise<BingoConfig> {
  const { data, error } = await getDb()
    .from("bingos")
    .insert({
      name: input.name,
      start_date: input.start || null,
      end_date: input.end || null,
      board_size: input.size || 16,
      status: "draft",
      created_by: input.createdBy || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const teams = input.teams ?? [];
  if (teams.length > 0) {
    const { error: teamError } = await getDb().from("bingo_teams").insert(
      teams.map((name) => ({
        bingo_id: data.id,
        name,
      }))
    );
    if (teamError) throw new Error(teamError.message);
  }

  return (await getActiveBingo()) ?? mapBingo(data);
}

export async function updateBingo(
  id: string,
  input: {
    name?: string;
    description?: string;
    status?: BingoStatus;
    start?: string;
    end?: string;
    size?: number;
    teams?: string[];
  }
): Promise<BingoConfig> {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) updates.status = input.status;
  if (input.start !== undefined) updates.start_date = input.start;
  if (input.end !== undefined) updates.end_date = input.end;
  if (input.size !== undefined) updates.board_size = input.size;

  const { data, error } = await getDb()
    .from("bingos")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  // If teams are provided, replace them atomically (preserves ids/player
  // assignments for teams whose name is unchanged; see replace_bingo_teams).
  if (input.teams !== undefined) {
    const { error: teamsError } = await getDb().rpc("replace_bingo_teams", {
      p_bingo_id: id,
      p_team_names: input.teams,
    });
    if (teamsError) throw new Error(teamsError.message);
  }

  const { data: full, error: fullError } = await bingoWithTeamsQuery()
    .eq("id", id)
    .single();

  if (fullError) throw new Error(fullError.message);
  return mapBingo(full);
}

export async function saveActiveBingoBoard(tiles: Tile[]): Promise<Tile[]> {
  const bingo = await getActiveBingo();
  if (!bingo?.id) throw new Error("Create bingo details before creating a board.");

  const rows = tiles.map((tileWithId, index) => {
    // Strip the row id a previously-fetched board may carry — metadata stores
    // only the tile definition; ids are regenerated on insert.
    const { id: _id, ...tile } = tileWithId;
    const targetValue =
      tile.killCount ?? tile.experience ?? tile.dropsAmount ?? null;

    return {
      position: index,
      type: tile.type,
      task: tile.task,
      points: tile.points,
      target_value: typeof targetValue === "number" ? targetValue : null,
      metadata: tile,
    };
  });

  // Atomic replace (delete + insert in one transaction) — avoids a window
  // where concurrent readers see an empty board.
  const { error } = await getDb().rpc("replace_bingo_board", {
    p_bingo_id: bingo.id,
    p_tiles: rows,
  });
  if (error) throw new Error(error.message);

  return tiles;
}

/**
 * Atomically flips a bingo from draft -> active (setting start_date if unset).
 * Returns false if this call lost the race (already active, or not a draft).
 */
export async function activateBingo(bingoId: string): Promise<boolean> {
  const { data, error } = await getDb().rpc("activate_bingo", {
    p_bingo_id: bingoId,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * Draft bingos whose scheduled start_date has already passed — used by the
 * snapshot cron to auto-activate them without an admin manually clicking
 * "Start now".
 */
export async function getDueDraftBingos(): Promise<BingoConfig[]> {
  const { data, error } = await bingoWithTeamsQuery()
    .eq("status", "draft")
    .not("start_date", "is", null)
    .lte("start_date", new Date().toISOString());

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBingo(row));
}

export async function getActiveBingoBoard(): Promise<Tile[]> {
  const bingo = await getActiveBingo();
  if (!bingo?.id) return [];

  const { data, error } = await getDb()
    .from("bingo_board_tiles")
    .select("id, metadata")
    .eq("bingo_id", bingo.id)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  // Tiles carry their row id so the screenshot review UI can reference them.
  return (data ?? []).map((row) => ({ ...(row.metadata as Tile), id: row.id }));
}
