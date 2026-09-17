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
import http from "node:http";
import jwt from "jsonwebtoken";
import { SQL } from "bun";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import type { BingoStatus } from "../../src/types/index.js";

const execFileAsync = promisify(execFile);

/**
 * Captured at module load, before any test file's `beforeEach` can run.
 * `getLocalStackConfig()`'s reachability probe below used to read the bare
 * `fetch` global at call time. `resolveCredentialsFromCli()` awaits a
 * subprocess first, which is long enough to yield the event loop to other
 * test files; if `tests/unit/dependencyHealth.test.ts`'s `globalThis.fetch`
 * mock happened to be active when execution resumed, the probe rejected
 * against a stub that only knows three unrelated hostnames, and the false
 * "unreachable" verdict got cached for the rest of the process (#101). This
 * reference can't be swapped out from under it.
 */
const nativeFetch = globalThis.fetch;

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

/** Test-only: forces the next `getLocalStackConfig()` call to re-resolve instead of reusing the cache. */
export function _resetLocalStackConfigForTests(): void {
  cachedConfig = null;
}

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
        const res = await nativeFetch(`${creds.url}/rest/v1/`, {
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

/**
 * Independent, uncached reachability check against `config.url`, using the
 * same pinned `nativeFetch` reference `getLocalStackConfig()` uses. Exists
 * for `localStackConfigLeak.test.ts`'s guard: if this ever disagrees with a
 * cached "unreachable" verdict, something poisoned the cache earlier in the
 * process (see #101) and the run should fail loudly instead of silently
 * skipping every integration test.
 */
export async function probeStackReachableNow(config: LocalStackConfig): Promise<boolean> {
  if (!config.serviceRoleKey) return false;
  try {
    const res = await nativeFetch(`${config.url}/rest/v1/`, {
      headers: { apikey: config.serviceRoleKey },
      signal: AbortSignal.timeout(5_000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

// -------------------------------------------------------
// getLatestBingo() isolation lock (#49).
//
// getLatestBingo() (src/db/bingos.ts) picks the single most-recently-created
// row across the whole `bingos` table, not scoped to any one test's own
// fixtures. Two getLatestBingo()-dependent tests each inserting a bingo and
// then asserting they get it back are racy against each other whenever they
// run concurrently against the same shared stack — including across two
// separate `bun test` processes (see TEAM-BRIEF.md's "one shared database"
// note): whichever insert lands last wins, so an un-serialized pair can
// observe the other's row instead of its own.
// -------------------------------------------------------

/**
 * Arbitrary but fixed 64-bit key for the advisory lock every
 * getLatestBingo()-dependent test contends for. Only needs to stay stable
 * and not collide with some other advisory lock this codebase might one day
 * take — there's no other one today.
 */
const GET_LATEST_BINGO_LOCK_KEY = 49_102_602;

let cachedDbUrl: Promise<string | null> | null = null;

/**
 * Raw Postgres connection string for the same local stack
 * `getLocalStackConfig()` targets, resolved independently of whichever path
 * resolved the REST url/key — `TEST_SUPABASE_URL`/`KEY`, when set, don't
 * necessarily point at a target with direct Postgres access (e.g. a
 * disposable hosted project behind a connection pooler). Preferring:
 *   1. `TEST_SUPABASE_DB_URL`, if set — an explicit companion to a
 *      `TEST_SUPABASE_URL` override.
 *   2. `bun x supabase status -o env`'s own `DB_URL` — the same local CLI
 *      stack `getLocalStackConfig()` falls back to. This is what CI's
 *      backend job actually runs against even though it sets
 *      `TEST_SUPABASE_URL`/`KEY` explicitly (`.github/workflows/ci.yml`
 *      resolves both from the same locally-started stack), so this still
 *      finds the right database there without a third CI env var.
 */
async function resolveDbUrl(): Promise<string | null> {
  if (!cachedDbUrl) {
    cachedDbUrl = (async (): Promise<string | null> => {
      if (process.env.TEST_SUPABASE_DB_URL) return process.env.TEST_SUPABASE_DB_URL;
      try {
        const { stdout } = await execFileAsync("bun", ["x", "supabase", "status", "-o", "env"], {
          cwd: BACKEND_DIR,
          timeout: 15_000,
        });
        return stdout.match(/^DB_URL="([^"]*)"/m)?.[1] ?? null;
      } catch {
        return null;
      }
    })();
  }
  return cachedDbUrl;
}

/** Test-only: forces the next `resolveDbUrl()`/`withGetLatestBingoLock()` call to re-resolve. */
export function _resetDbUrlCacheForTests(): void {
  cachedDbUrl = null;
}

const DEFAULT_LOCK_TIMEOUT_MS = 20_000;

/**
 * Wrap the insert-then-assert critical section of a getLatestBingo()-
 * dependent test in this so only one such test, across every process
 * sharing the stack, runs it at a time:
 *
 *   await withGetLatestBingoLock(async () => {
 *     const bingo = await insertTestBingo(`test-${uniqueSuffix()}`);
 *     expect((await getLatestBingo())?.id).toBe(bingo.id);
 *   });
 *
 * Backed by a session-scoped `pg_advisory_lock` on its own dedicated
 * connection — PostgREST's pooled connections can't hold one across the
 * callback. `lock_timeout` bounds the wait: a holder that's stuck or
 * crashed without releasing fails the waiter loudly after `timeoutMs`
 * instead of hanging the run. (Postgres also auto-releases the lock if the
 * holder's own connection drops, e.g. its process crashes outright — a
 * second line of defense behind the timeout.)
 */
export async function withGetLatestBingoLock<T>(
  fn: () => Promise<T>,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = Math.max(0, Math.trunc(options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS));
  const dbUrl = await resolveDbUrl();
  if (!dbUrl) {
    throw new Error(
      "withGetLatestBingoLock: could not resolve a raw Postgres connection string — set " +
        "TEST_SUPABASE_DB_URL, or start the local stack via `bun run db:start` " +
        "(`bun x supabase status` failed).",
    );
  }

  const sql = new SQL(dbUrl);
  try {
    // lock_timeout can't be bound as a query parameter (Postgres doesn't
    // accept placeholders in SET); timeoutMs is internally controlled and
    // coerced to a non-negative integer above, so building the statement
    // directly is safe here.
    await sql.unsafe(`SET lock_timeout = ${timeoutMs}`);
    try {
      await sql`SELECT pg_advisory_lock(${GET_LATEST_BINGO_LOCK_KEY})`;
    } catch (err) {
      throw new Error(
        `withGetLatestBingoLock: failed to acquire the getLatestBingo() isolation lock within ` +
          `${timeoutMs}ms — a stuck or crashed holder likely never released it: ${String(err)}`,
      );
    }
    try {
      return await fn();
    } finally {
      await sql`SELECT pg_advisory_unlock(${GET_LATEST_BINGO_LOCK_KEY})`;
    }
  } finally {
    await sql.end();
  }
}

/**
 * Test-only: opens a dedicated connection and acquires the getLatestBingo()
 * lock without a timeout, and without ever calling `withGetLatestBingoLock`,
 * to simulate a stuck or crashed holder for
 * `getLatestBingoLock.test.ts`'s timeout proof. The caller must always
 * `release()`, even on failure — until then this connection holds the lock
 * for real, on the shared stack, blocking every other track's
 * getLatestBingo()-dependent test too.
 */
export async function _acquireStuckGetLatestBingoLockForTests(): Promise<{ release: () => Promise<void> }> {
  const dbUrl = await resolveDbUrl();
  if (!dbUrl) {
    throw new Error("_acquireStuckGetLatestBingoLockForTests: could not resolve a raw Postgres connection string.");
  }
  const sql = new SQL(dbUrl);
  await sql`SELECT pg_advisory_lock(${GET_LATEST_BINGO_LOCK_KEY})`;
  return {
    release: async () => {
      await sql`SELECT pg_advisory_unlock(${GET_LATEST_BINGO_LOCK_KEY})`;
      await sql.end();
    },
  };
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

/**
 * The exact `rsn` spellings stored for a bingo, matched case-insensitively.
 *
 * `bingo_players.rsn` is `citext` since 20260910000000, so `.eq("rsn", ...)`
 * matches regardless of case and counting rows can no longer tell you which
 * spelling landed in the table. Use this when a test needs to prove that an
 * existing row was reused rather than replaced by a differently-cased one.
 */
export async function getBingoPlayerRsnSpellings(
  bingoId: string,
  rsn: string,
): Promise<string[]> {
  const { data, error } = await getDb()
    .from("bingo_players")
    .select("rsn")
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn);

  if (error) throw new Error(`Failed to read player rows for "${rsn}": ${error.message}`);
  return (data ?? []).map((row) => row.rsn as string);
}

// -------------------------------------------------------
// Minimal HTTP test harness for route-level tests (guard checks, authz,
// status codes) — TEAM-BRIEF.md Sprint 17, Track A1. Same shape as the
// hand-rolled harness in adminRouteMounting.test.ts, centralized here so
// every new route test file doesn't reimplement it. Callers spin up their
// own `express()` app (mounting whatever router(s) + errorHandler they need)
// and use jsonRequest() to hit it.
// -------------------------------------------------------

export interface TestUser {
  id: string;
  username: string;
  role: "user" | "admin" | "moderator";
}

/** Inserts a throwaway user row directly (bypasses db/users.ts — no real password needed for these tests). */
export async function insertTestUser(role: TestUser["role"], labelPrefix = "Test"): Promise<TestUser> {
  const username = `${labelPrefix}${role}${uniqueSuffix()}`;
  const { data, error } = await getDb()
    .from("users")
    .insert({ username, password_hash: "x", role })
    .select("id, username, role")
    .single();
  if (error || !data) throw new Error(`Failed to insert test user "${username}": ${error?.message}`);
  return data as TestUser;
}

export async function deleteTestUser(id: string): Promise<void> {
  await getDb()
    .from("users")
    .delete()
    .eq("id", id)
    .then(() => undefined, () => undefined);
}

export function signTestToken(user: TestUser): string {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, getJwtSecret(), { expiresIn: "1h" });
}

export interface TestHttpResponse {
  status: number;
  body: any;
  /** Raw response headers (Node's lowercase-keyed shape), for tests that need e.g. Set-Cookie. */
  headers: NodeJS.Dict<string | string[]>;
}

export interface JsonRequestOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Fires a single HTTP request at a locally-listening test server (see startTestServer below). */
export function jsonRequest(
  port: number,
  method: string,
  path: string,
  options: JsonRequestOptions = {},
): Promise<TestHttpResponse> {
  return new Promise((resolve, reject) => {
    const payload = options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload).toString();
    }

    const req = http.request({ host: "127.0.0.1", port, path, method, headers }, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : undefined, headers: res.headers });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

/** Starts `app` listening on an ephemeral local port; caller is responsible for `.close()`ing it. */
export function startTestServer(app: import("express").Express): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      resolve({ server, port });
    });
  });
}

/**
 * Temporarily overrides `process.env.ALLOW_DEV_AUTH` for the duration of
 * `fn`, then restores whatever value (including "unset") was there before —
 * even if `fn` throws/an `expect()` inside it fails, via `finally`.
 *
 * `middleware/auth.ts`'s `protect` reads this env var fresh on every
 * request (no caching), so a "no token -> 401" assertion is only
 * deterministic if the test controls this value itself: a developer's local
 * `backend/.env` commonly sets `ALLOW_DEV_AUTH=true` (see `.env.example`),
 * which makes `protect` inject the local-dev admin user for a token-less
 * request instead of rejecting it — turning an intended 401 into a 200/404/
 * etc. depending on the route. Wrap any "no token" authz assertion in
 * `withAllowDevAuth("false", async () => { ... })` so it passes regardless
 * of what's in `.env`. Use `withAllowDevAuth("true", async () => { ... })`
 * to instead pin the bypass's own accept-as-dev-user behavior.
 */
export async function withAllowDevAuth<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.ALLOW_DEV_AUTH;
  if (value === undefined) delete process.env.ALLOW_DEV_AUTH;
  else process.env.ALLOW_DEV_AUTH = value;

  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.ALLOW_DEV_AUTH;
    else process.env.ALLOW_DEV_AUTH = previous;
  }
}
