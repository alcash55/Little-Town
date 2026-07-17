/**
 * Shared setup for integration tests that hit the local Supabase stack
 * (http://127.0.0.1:54321 by default).
 *
 * Credentials are resolved once (module-level cache, reused across every
 * integration test file within the same `bun test` run):
 *   1. TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY, if BOTH are set —
 *      an explicit, test-scoped override (e.g. CI without the Supabase CLI
 *      available, or pointing at a disposable test project). These names
 *      are deliberately distinct from SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
 *      so bun auto-loading backend/.env (which holds the hosted PROD
 *      project's credentials) can never silently satisfy them.
 *   2. Otherwise, `bun x supabase status -o env` — the local CLI's own demo
 *      project keys (fixed, publicly documented placeholders baked into
 *      every `supabase init` project; not a real secret). This is the
 *      default target: no env vars needed, just `bun run db:start`.
 *
 * Plain SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the environment (i.e.
 * backend/.env) are NEVER read here — that was the bug that let integration
 * tests silently run against the hosted prod project. A guardrail below
 * throws (rather than skips) if a resolved URL ever looks like a hosted
 * Supabase project without TEST_SUPABASE_URL explicitly set, as a backstop
 * against that fallthrough being reintroduced by a future edit.
 *
 * If neither source resolves, or the resolved URL doesn't actually respond,
 * the stack is treated as unreachable and callers should skip via
 * `describe.skipIf(!(await getLocalStackConfig()).reachable)`.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { getDb } from "../../src/db/client.js";
import type { BingoStatus } from "../../src/types/index.js";

const execFileAsync = promisify(execFile);

export interface LocalStackConfig {
  reachable: boolean;
  reason?: string;
  url: string;
  serviceRoleKey: string;
}

const BACKEND_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");

const NO_TARGET_MESSAGE =
  "could not resolve Supabase test credentials — set TEST_SUPABASE_URL/TEST_SUPABASE_SERVICE_ROLE_KEY, " +
  "or start the local stack via `bun run db:start` (`bun x supabase status` failed)";

async function resolveCredentialsFromCli(): Promise<{ url: string; key: string } | null> {
  try {
    const { stdout } = await execFileAsync("bun", ["x", "supabase", "status", "-o", "env"], {
      cwd: BACKEND_DIR,
      timeout: 15_000,
    });
    const url = stdout.match(/^API_URL="([^"]*)"/m)?.[1];
    const key = stdout.match(/^SERVICE_ROLE_KEY="([^"]*)"/m)?.[1];
    if (!url || !key) return null;
    return { url, key };
  } catch {
    return null;
  }
}

/**
 * Explicit test-scoped override. Deliberately does NOT read plain
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY — those come from backend/.env
 * (hosted prod) via bun's auto-load and must never be picked up here.
 */
function resolveCredentialsFromTestEnv(): { url: string; key: string } | null {
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return { url, key };
  return null;
}

/**
 * Belt-and-suspenders guardrail: refuse (throw, don't skip) rather than run
 * integration tests against what looks like a hosted Supabase project
 * unless TEST_SUPABASE_URL was explicitly set. Guards against a future edit
 * reintroducing a plain-env fallthrough to backend/.env's prod URL.
 */
function assertNotAccidentalProd(url: string, explicitOverride: boolean): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  if (host.endsWith(".supabase.co") && !explicitOverride) {
    throw new Error(
      `Refusing to run integration tests against "${url}": it looks like a hosted Supabase ` +
        "project (*.supabase.co) but TEST_SUPABASE_URL was not explicitly set. This guards " +
        "against integration tests silently hitting production. If this is intentional, set " +
        "TEST_SUPABASE_URL/TEST_SUPABASE_SERVICE_ROLE_KEY explicitly.",
    );
  }
}

let cachedConfig: Promise<LocalStackConfig> | null = null;

export function getLocalStackConfig(): Promise<LocalStackConfig> {
  if (!cachedConfig) {
    cachedConfig = (async (): Promise<LocalStackConfig> => {
      const testEnvCreds = resolveCredentialsFromTestEnv();
      const creds = testEnvCreds ?? (await resolveCredentialsFromCli());

      if (!creds) {
        return {
          reachable: false,
          reason: NO_TARGET_MESSAGE,
          url: "http://127.0.0.1:54321",
          serviceRoleKey: "",
        };
      }

      assertNotAccidentalProd(creds.url, testEnvCreds !== null);

      try {
        const res = await fetch(`${creds.url}/rest/v1/`, {
          headers: { apikey: creds.key },
          signal: AbortSignal.timeout(5_000),
        });
        // PostgREST's root route replies 200 with the OpenAPI spec; anything
        // that isn't a network failure means the stack is up.
        if (res.status >= 500) {
          return {
            reachable: false,
            reason: `local Supabase REST responded ${res.status} at ${creds.url}`,
            url: creds.url,
            serviceRoleKey: creds.key,
          };
        }
      } catch (err) {
        return {
          reachable: false,
          reason: `local Supabase unreachable at ${creds.url}: ${String(err)}`,
          url: creds.url,
          serviceRoleKey: creds.key,
        };
      }

      // getDb() is a lazy singleton that reads these on first call.
      process.env.SUPABASE_URL = creds.url;
      process.env.SUPABASE_SERVICE_ROLE_KEY = creds.key;

      return { reachable: true, url: creds.url, serviceRoleKey: creds.key };
    })();
  }
  return cachedConfig;
}

/** True when a bingo somewhere in the shared local stack already has status='active'. */
export async function hasPreexistingActiveBingo(): Promise<boolean> {
  const { data, error } = await getDb().from("bingos").select("id").eq("status", "active").limit(1);
  if (error) throw new Error(`Failed to check for an active bingo: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * True if `table.column` exists in the connected database. Used to
 * `skipIf` tests that depend on a migration (e.g. `player_id`, an RPC's
 * backing column) that may not have landed yet — see the NOTE at the top of
 * TEAM-BRIEF.md.
 */
export async function columnExists(table: string, column: string): Promise<boolean> {
  const { error } = await getDb().from(table).select(column).limit(0);
  if (!error) return true;
  // PostgREST reports "column does not exist" as Postgres code 42703.
  if ((error as { code?: string }).code === "42703") return false;
  throw new Error(`Failed to check for column "${table}.${column}": ${error.message}`);
}

// -------------------------------------------------------
// Raw fixture helpers (bypass src/db wrappers so fixture setup never
// depends on the ambiguous-global-read behavior of e.g. getActiveBingo()).
// -------------------------------------------------------

export interface BingoRow {
  id: string;
  name: string;
  status: BingoStatus;
  start_date: string | null;
  end_date: string | null;
  board_size: number;
}

export async function insertTestBingo(
  name: string,
  overrides: Partial<{
    status: BingoStatus;
    board_size: number;
    start_date: string | null;
    end_date: string | null;
  }> = {},
): Promise<BingoRow> {
  const { data, error } = await getDb()
    .from("bingos")
    .insert({
      name,
      status: overrides.status ?? "draft",
      board_size: overrides.board_size ?? 16,
      ...(overrides.start_date !== undefined ? { start_date: overrides.start_date } : {}),
      ...(overrides.end_date !== undefined ? { end_date: overrides.end_date } : {}),
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(`Failed to insert test bingo "${name}": ${error?.message}`);
  return data as BingoRow;
}

/** Deletes a test bingo; cascades teams/players/tiles/snapshots via FK ON DELETE CASCADE. */
export async function deleteTestBingo(id: string): Promise<void> {
  const { error } = await getDb().from("bingos").delete().eq("id", id);
  if (error) throw new Error(`Failed to clean up test bingo ${id}: ${error.message}`);
}

export async function getBingoRow(id: string): Promise<BingoRow> {
  const { data, error } = await getDb().from("bingos").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`Failed to fetch bingo ${id}: ${error?.message}`);
  return data as BingoRow;
}

export interface BingoTeamRow {
  id: string;
  bingo_id: string;
  name: string;
  sort_order: number;
}

export async function insertTestTeam(bingoId: string, name: string): Promise<BingoTeamRow> {
  const { data, error } = await getDb()
    .from("bingo_teams")
    .insert({ bingo_id: bingoId, name })
    .select("*")
    .single();

  if (error || !data) throw new Error(`Failed to insert test team "${name}": ${error?.message}`);
  return data as BingoTeamRow;
}

export async function getTeamRows(bingoId: string): Promise<BingoTeamRow[]> {
  const { data, error } = await getDb().from("bingo_teams").select("*").eq("bingo_id", bingoId);
  if (error) throw new Error(`Failed to fetch teams for bingo ${bingoId}: ${error.message}`);
  return (data ?? []) as BingoTeamRow[];
}

export interface BingoBoardTileRow {
  id: string;
  bingo_id: string;
  position: number;
  type: "Kill Count" | "Experience" | "Drops";
  task: string;
  points: number;
  target_value: number | null;
}

/**
 * Inserts a single board tile row directly (bypassing saveActiveBingoBoard,
 * which resolves "the active bingo" globally rather than taking an explicit
 * bingo id — unsafe for fixtures on a shared local stack).
 *
 * `targetValue` defaults to unset (column default: NULL) — only pass it when
 * a test specifically asserts on it (TEAM-BRIEF.md Sprint 8, Track A item 4).
 */
export async function insertTestTile(
  bingoId: string,
  overrides: Partial<{
    position: number;
    type: "Kill Count" | "Experience" | "Drops";
    task: string;
    points: number;
    targetValue: number;
  }> = {},
): Promise<BingoBoardTileRow> {
  const { data, error } = await getDb()
    .from("bingo_board_tiles")
    .insert({
      bingo_id: bingoId,
      position: overrides.position ?? 0,
      type: overrides.type ?? "Drops",
      task: overrides.task ?? `Test Tile ${uniqueSuffix()}`,
      points: overrides.points ?? 10,
      target_value: overrides.targetValue ?? null,
    })
    .select("id, bingo_id, position, type, task, points, target_value")
    .single();

  if (error || !data) throw new Error(`Failed to insert test tile: ${error?.message}`);
  return data as BingoBoardTileRow;
}

export async function countHiscoreRows(playerId: string, type: "start" | "current"): Promise<number> {
  const { count, error } = await getDb()
    .from("bingo_player_hiscores")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("type", type)
    .is("side_account_id", null);

  if (error) throw new Error(`Failed to count ${type} snapshots for ${playerId}: ${error.message}`);
  return count ?? 0;
}

export async function countBingoPlayerRows(bingoId: string, rsn: string): Promise<number> {
  const { count, error } = await getDb()
    .from("bingo_players")
    .select("id", { count: "exact", head: true })
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn);

  if (error) throw new Error(`Failed to count player rows for "${rsn}": ${error.message}`);
  return count ?? 0;
}
