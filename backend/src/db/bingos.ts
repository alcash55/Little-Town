import { getDb } from "./client.js";
import { AppError } from "../middleware/errorHandler.js";
import { BingoConfig, BingoStatus } from "../types/index.js";

type Tile = Record<string, unknown> & {
  // Only ever present on tiles returned by getActiveBingoBoard() below (it
  // attaches the bingo_board_tiles row id after spreading metadata) — not
  // on the tile literals passed INTO saveActiveBingoBoard(), which strips
  // any incoming id before insert. Optional here so both call shapes
  // type-check; readers that need it (e.g. GET /api/bingo/board) go through
  // getActiveBingoBoard(), where it's always populated.
  id?: string;
  type: "Kill Count" | "Experience" | "Drops";
  task: string;
  points: number;
  // Only ever present on tiles returned by getActiveBingoBoard() (TEAM-BRIEF.md
  // Sprint 8, Track A item 4) — read from the row's own `target_value` column,
  // NOT from `metadata` (metadata only carries the admin's original tile
  // literal — killCount/experience/dropsAmount — which is what target_value
  // is derived FROM at save time in saveActiveBingoBoard, not a duplicate of
  // it). Absent (rather than `null`) on tile literals passed into
  // saveActiveBingoBoard(), same optionality reasoning as `id` above.
  target_value?: number | null;
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

/**
 * The single most-recently-created bingo, REGARDLESS of status (draft,
 * active, complete, or archived) — null only when no bingo has ever been
 * created. Frozen contract (TEAM-BRIEF.md Sprint 15, Track A):
 * `GET /api/admin/bingo/latest` is how the overview + screenshot-review
 * pages resolve "the bingo" now that a bingo can legitimately be
 * status='complete' (getActiveBingo()'s active/draft-only definition would
 * wrongly return null for a just-ended bingo whose leftover pending
 * screenshots still need review). Deliberately does NOT filter by status at
 * all, unlike getActiveBingo() above — that's the whole point of this
 * function existing as a separate query rather than widening getActiveBingo.
 */
export async function getLatestBingo(): Promise<BingoConfig | null> {
  const { data, error } = await bingoWithTeamsQuery()
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

/**
 * Board tiles for an explicit bingo id, regardless of that bingo's status.
 * Extracted from getActiveBingoBoard() below (TEAM-BRIEF.md Sprint 15, Track
 * A review-endpoints audit) so callers that must keep working after a bingo
 * completes — e.g. GET /bingo/screenshots/unattributed's tile-task lookup —
 * aren't forced through getActiveBingo()'s active/draft-only resolution just
 * to read tile metadata.
 */
export async function getBingoBoardById(bingoId: string): Promise<Tile[]> {
  const { data, error } = await getDb()
    .from("bingo_board_tiles")
    .select("id, type, task, points, target_value, metadata")
    .eq("bingo_id", bingoId)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  // Tiles carry their row id so the screenshot review UI can reference them.
  // `type`/`task`/`points`/`target_value` come from the row's own typed,
  // NOT NULL-constrained columns (TEAM-BRIEF.md Sprint 8, Track A item 4) —
  // the authoritative source — rather than `metadata`, which only carries
  // the admin's original tile literal (killCount/experience/dropsAmount,
  // used by other callers below) and doesn't itself contain a
  // `target_value` key. `metadata` is spread first so its extra fields
  // (killCount/experience/dropsAmount) still come through for existing
  // callers, then overridden by the real columns for the fields both share.
  return (data ?? []).map((row) => ({
    ...(row.metadata as Tile),
    id: row.id,
    type: row.type,
    task: row.task,
    points: row.points,
    target_value: row.target_value ?? null,
  }));
}

export async function getActiveBingoBoard(): Promise<Tile[]> {
  const bingo = await getActiveBingo();
  if (!bingo?.id) return [];
  return getBingoBoardById(bingo.id);
}

// -------------------------------------------------------
// Delete (TEAM-BRIEF.md Sprint 17, Track A2, contract A2)
// -------------------------------------------------------

export interface BingoDeleteCounts {
  teams: number;
  tiles: number;
  players: number;
  submissions: number;
}

/**
 * Row counts across every table with a DIRECT bingo_id -> bingos(id) FK,
 * taken BEFORE the delete. The DELETE itself is a single statement against
 * `bingos`; every one of these four tables (plus everything transitively
 * hanging off bingo_players/bingo_teams — side accounts, hiscores, hiscore
 * history, rsn_change_log) is removed by ON DELETE CASCADE as part of that
 * same transaction, but a cascade delete doesn't surface a row count back
 * to the statement that triggered it, so the counts have to be read first.
 * See the Sprint 17 data-engineer report for the full table-by-table
 * cascade walk this was verified against.
 *
 * Cheap even for a busy bingo (tens of teams/players, low hundreds of
 * tiles/submissions) — four indexed `count(*)` reads on an admin-only,
 * one-shot delete path, not a hot loop.
 */
export async function getBingoDeleteCounts(bingoId: string): Promise<BingoDeleteCounts> {
  const db = getDb();

  const countRows = async (table: string): Promise<number> => {
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("bingo_id", bingoId);
    if (error) throw new Error(`Failed to count ${table} for bingo ${bingoId}: ${error.message}`);
    return count ?? 0;
  };

  const [teams, tiles, players, submissions] = await Promise.all([
    countRows("bingo_teams"),
    countRows("bingo_board_tiles"),
    countRows("bingo_players"),
    countRows("bingo_submissions"),
  ]);

  return { teams, tiles, players, submissions };
}

/**
 * Deletes a bingo row outright. Every child row this sprint's cascade walk
 * found (teams, tiles, players, submissions, and transitively side
 * accounts, hiscores, hiscore history, rsn_change_log) is removed by an
 * existing ON DELETE CASCADE FK — see the migrations listed in the Sprint
 * 17 cascade-walk report. This function does nothing beyond the single
 * DELETE; it does NOT purge the `screenshots` storage bucket (Postgres
 * cannot reach that — call `purgeBingoScreenshots` from bingoSubmissions.ts
 * separately; either order is safe since that helper lists by the bingoId
 * path prefix rather than reading bingo_submissions rows).
 *
 * The active-bingo refusal / force + X-Confirm-Delete gate is route-layer
 * guard logic (TEAM-BRIEF.md: backend agent's), not this function's job —
 * this is the unconditional delete the route calls once its own guards
 * pass. Returns false (not an error) if no bingo with this id existed, so
 * the route can turn that into its own 404.
 */
export async function deleteBingoRow(bingoId: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from("bingos")
    .delete()
    .eq("id", bingoId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to delete bingo ${bingoId}: ${error.message}`);
  return data !== null;
}

// -------------------------------------------------------
// Clone (TEAM-BRIEF.md Sprint 17, Track A2, contract A3)
// -------------------------------------------------------

export interface CloneBingoResult {
  id: string;
  name: string;
  status: BingoStatus;
  tilesCloned: number;
}

/**
 * Clones a bingo's board tiles into a brand-new 'draft' bingo, via the
 * `clone_bingo` RPC (see the migration for the full rationale, including a
 * flagged contract-deviation note on carrying `metadata` along with the
 * enumerated task/type/points/target_value/position columns). Never copies
 * teams, players, submissions, or snapshots — those stay scoped to the
 * source bingo.
 *
 * Error mapping mirrors acceptInvite's convention (invites.ts): the RPC's
 * distinct RAISE EXCEPTION messages are matched by text into the frozen
 * 404 / 409 contract responses; anything else is rethrown as-is so
 * errorHandler's Postgres-code mapping still applies.
 */
export async function cloneBingo(input: {
  sourceBingoId: string;
  name: string;
  startDate: string;
  endDate: string;
}): Promise<CloneBingoResult> {
  const { data, error } = await getDb().rpc("clone_bingo", {
    p_source_bingo_id: input.sourceBingoId,
    p_name: input.name,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
  });

  if (error) {
    if (/source bingo not found/i.test(error.message)) {
      throw new AppError("Source bingo not found", 404, "BINGO_NOT_FOUND");
    }
    if (/an active bingo already exists/i.test(error.message)) {
      throw new AppError("An active bingo already exists", 409, "BINGO_ACTIVE");
    }
    throw error;
  }

  // clone_bingo is a RETURNS TABLE function — PostgREST/supabase-js returns
  // its result as an array of rows, one row here since it always returns
  // exactly the newly-created bingo.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; name: string; status: BingoStatus; tiles_cloned: number }
    | undefined;
  if (!row) throw new Error("clone_bingo returned no row");

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    tilesCloned: row.tiles_cloned,
  };
}
