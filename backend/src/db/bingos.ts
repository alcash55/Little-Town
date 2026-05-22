import { getDb } from "./client.js";
import { BingoConfig, BingoStatus } from "../types/index.js";

type Tile = Record<string, unknown> & {
  type: "Kill Count" | "Experience" | "Drops";
  task: string;
  points: number;
};

function mapBingo(row: Record<string, any>): BingoConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    boardSize: row.board_size,
    numberOfTeams: row.bingo_teams?.length ?? 0,
    teams: row.bingo_teams?.map((team: { name: string }) => team.name) ?? [],
    tasks: row.bingo_board_tiles?.map((tile: { task: string }) => tile.task) ?? [],
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBingos(): Promise<BingoConfig[]> {
  const { data, error } = await getDb()
    .from("bingos")
    .select("*, bingo_teams(name), bingo_board_tiles(task)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBingo(row));
}

export async function getActiveBingo(): Promise<BingoConfig | null> {
  const { data, error } = await getDb()
    .from("bingos")
    .select("*, bingo_teams(name), bingo_board_tiles(task)")
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
      teams.map((name, index) => ({
        bingo_id: data.id,
        name,
        sort_order: index,
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

  // If teams are provided, replace them
  if (input.teams !== undefined) {
    const { error: deleteError } = await getDb()
      .from("bingo_teams")
      .delete()
      .eq("bingo_id", id);
    if (deleteError) throw new Error(deleteError.message);

    if (input.teams.length > 0) {
      const { error: insertError } = await getDb()
        .from("bingo_teams")
        .insert(
          input.teams.map((name, index) => ({
            bingo_id: id,
            name,
            sort_order: index,
          }))
        );
      if (insertError) throw new Error(insertError.message);
    }
  }

  const { data: full, error: fullError } = await getDb()
    .from("bingos")
    .select("*, bingo_teams(name), bingo_board_tiles(task)")
    .eq("id", id)
    .single();

  if (fullError) throw new Error(fullError.message);
  return mapBingo(full);
}

export async function saveActiveBingoBoard(tiles: Tile[]): Promise<Tile[]> {
  const bingo = await getActiveBingo();
  if (!bingo?.id) throw new Error("Create bingo details before creating a board.");

  await getDb().from("bingo_board_tiles").delete().eq("bingo_id", bingo.id);

  const rows = tiles.map((tile, index) => {
    const targetValue =
      tile.killCount ?? tile.experience ?? tile.dropsAmount ?? null;

    return {
      bingo_id: bingo.id,
      position: index,
      type: tile.type,
      task: tile.task,
      points: tile.points,
      target_value: typeof targetValue === "number" ? targetValue : null,
      metadata: tile,
    };
  });

  if (rows.length > 0) {
    const { error } = await getDb().from("bingo_board_tiles").insert(rows);
    if (error) throw new Error(error.message);
  }

  return tiles;
}

export async function getActiveBingoBoard(): Promise<Tile[]> {
  const bingo = await getActiveBingo();
  if (!bingo?.id) return [];

  const { data, error } = await getDb()
    .from("bingo_board_tiles")
    .select("metadata")
    .eq("bingo_id", bingo.id)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.metadata as Tile);
}
