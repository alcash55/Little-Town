/**
 * Shared setup for integration tests that hit the local Supabase stack
 * (http://127.0.0.1:54321 by default).
 *
 * Credentials are resolved once (module-level cache, reused across every
 * integration test file within the same `bun test` run):
 *   1. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the environment if
 *      already set (e.g. a checked-out .env, or CI secrets).
 *   2. Otherwise, `bun x supabase status -o env` — the local CLI's own demo
 *      project keys (fixed, publicly documented placeholders baked into
 *      every `supabase init` project; not a real secret).
 *
 * If neither resolves, or the resolved URL doesn't actually respond, the
 * stack is treated as unreachable and callers should skip via
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

let cachedConfig: Promise<LocalStackConfig> | null = null;

export function getLocalStackConfig(): Promise<LocalStackConfig> {
  if (!cachedConfig) {
    cachedConfig = (async (): Promise<LocalStackConfig> => {
      const envCreds =
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
          ? { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }
          : await resolveCredentialsFromCli();

      if (!envCreds) {
        return {
          reachable: false,
          reason:
            "could not resolve local Supabase credentials (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY unset " +
            "and `bun x supabase status` failed — is the local stack running via `bun run db:start`?)",
          url: "http://127.0.0.1:54321",
          serviceRoleKey: "",
        };
      }

      try {
        const res = await fetch(`${envCreds.url}/rest/v1/`, {
          headers: { apikey: envCreds.key },
          signal: AbortSignal.timeout(5_000),
        });
        // PostgREST's root route replies 200 with the OpenAPI spec; anything
        // that isn't a network failure means the stack is up.
        if (res.status >= 500) {
          return {
            reachable: false,
            reason: `local Supabase REST responded ${res.status} at ${envCreds.url}`,
            url: envCreds.url,
            serviceRoleKey: envCreds.key,
          };
        }
      } catch (err) {
        return {
          reachable: false,
          reason: `local Supabase unreachable at ${envCreds.url}: ${String(err)}`,
          url: envCreds.url,
          serviceRoleKey: envCreds.key,
        };
      }

      // getDb() is a lazy singleton that reads these on first call.
      process.env.SUPABASE_URL = envCreds.url;
      process.env.SUPABASE_SERVICE_ROLE_KEY = envCreds.key;

      return { reachable: true, url: envCreds.url, serviceRoleKey: envCreds.key };
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
  overrides: Partial<{ status: BingoStatus; board_size: number }> = {},
): Promise<BingoRow> {
  const { data, error } = await getDb()
    .from("bingos")
    .insert({
      name,
      status: overrides.status ?? "draft",
      board_size: overrides.board_size ?? 16,
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
