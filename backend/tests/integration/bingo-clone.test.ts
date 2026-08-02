/**
 * POST /api/admin/bingo/clone — TEAM-BRIEF.md Sprint 17, Track A3. Frozen
 * contract:
 *   201 { success: true, data: { id, name, status: "draft", tilesCloned } }
 *   404 source bingo not found
 *   409 { success: false, error: "An active bingo already exists" } // uq_bingos_one_active
 *
 * Delegates to db/bingos.ts's cloneBingo (clone_bingo RPC, data-engineer's
 * Track A2 work) — 404/409 are that function's AppErrors forwarded through
 * errorHandler untouched (tech lead's explicit instruction; NOTE this means
 * those two responses render as errorHandler's `{ error, code }` shape, not
 * this route's usual `{ success: false, error }` — see the sprint report's
 * flagged contract-conformance gap).
 *
 * Against the live local Supabase stack.
 */
process.env.JWT_SECRET = "bingo-clone-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import type http from "node:http";

import { errorHandler } from "../../src/middleware/errorHandler.js";
import adminRoutes from "../../src/routes/admin.js";
import { getDb } from "../../src/db/client.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  insertTestTile,
  insertTestUser,
  deleteTestUser,
  signTestToken,
  jsonRequest,
  startTestServer,
  uniqueSuffix,
  type TestUser,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[bingo-clone.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn("[bingo-clone.test.ts] skipping: another bingo is already active in the shared local stack");
}
const suite = stack.reachable && !preexistingActive;

const createdBingoIds: string[] = [];
const createdUserIds: string[] = [];

let server: http.Server;
let port: number;
let admin: TestUser;
let plainUser: TestUser;

beforeAll(async () => {
  if (!suite) return;

  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  app.use(errorHandler);
  ({ server, port } = await startTestServer(app));

  admin = await insertTestUser("admin", "Clone");
  plainUser = await insertTestUser("user", "Clone");
  createdUserIds.push(admin.id, plainUser.id);
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
  await Promise.all(createdUserIds.map((id) => deleteTestUser(id)));
});

function cloneBody(sourceBingoId: string, name: string) {
  return {
    sourceBingoId,
    name,
    startDate: "2026-08-01T00:00:00.000Z",
    endDate: "2026-08-15T00:00:00.000Z",
  };
}

describe.skipIf(!suite)("POST /api/admin/bingo/clone", () => {
  test("404 for a source bingo id that doesn't exist", async () => {
    const { status, body } = await jsonRequest(port, "POST", "/api/admin/bingo/clone", {
      token: signTestToken(admin),
      body: cloneBody("00000000-0000-0000-0000-000000000000", `test-clone-missing-${uniqueSuffix()}`),
    });
    expect(status).toBe(404);
    // Forwarded from cloneBingo's AppError via errorHandler — { error, code }, not { success:false, error }.
    expect(body.code).toBe("BINGO_NOT_FOUND");
  });

  test("201 happy path — clones tiles only, never teams/players, new bingo is a draft", async () => {
    const source = await insertTestBingo(`test-clone-source-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(source.id);
    await insertTestTile(source.id, { position: 0, task: "Kill 50 Zulrah", type: "Kill Count", points: 10 });
    await insertTestTile(source.id, { position: 1, task: "Get 1m Slayer XP", type: "Experience", points: 20 });

    const name = `test-clone-target-${uniqueSuffix()}`;
    const { status, body } = await jsonRequest(port, "POST", "/api/admin/bingo/clone", {
      token: signTestToken(admin),
      body: cloneBody(source.id, name),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ name, status: "draft", tilesCloned: 2 });
    expect(typeof body.data.id).toBe("string");
    expect(body.data.id).not.toBe(source.id);
    createdBingoIds.push(body.data.id);

    // Never copies teams/players (contract) — verify directly against the DB.
    const { data: clonedTeams } = await getDb().from("bingo_teams").select("id").eq("bingo_id", body.data.id);
    expect(clonedTeams?.length ?? 0).toBe(0);
    const { data: clonedPlayers } = await getDb().from("bingo_players").select("id").eq("bingo_id", body.data.id);
    expect(clonedPlayers?.length ?? 0).toBe(0);

    // Tiles for the NEW bingo, copied from source (task/type/points survive).
    const { data: clonedTiles } = await getDb()
      .from("bingo_board_tiles")
      .select("task, type, points")
      .eq("bingo_id", body.data.id)
      .order("position", { ascending: true });
    expect(clonedTiles).toEqual([
      { task: "Kill 50 Zulrah", type: "Kill Count", points: 10 },
      { task: "Get 1m Slayer XP", type: "Experience", points: 20 },
    ]);
  });

  test("409 when an active bingo already exists", async () => {
    const source = await insertTestBingo(`test-clone-conflict-source-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(source.id);
    const active = await insertTestBingo(`test-clone-conflict-active-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(active.id);

    const { status, body } = await jsonRequest(port, "POST", "/api/admin/bingo/clone", {
      token: signTestToken(admin),
      body: cloneBody(source.id, `test-clone-conflict-target-${uniqueSuffix()}`),
    });
    expect(status).toBe(409);
    expect(body.code).toBe("BINGO_ACTIVE");

    await deleteTestBingo(active.id); // free the one-active-bingo slot for later tests in this run
    createdBingoIds.splice(createdBingoIds.indexOf(active.id), 1);
  });

  test("403 for a plain user", async () => {
    const source = await insertTestBingo(`test-clone-authz-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(source.id);

    const { status } = await jsonRequest(port, "POST", "/api/admin/bingo/clone", {
      token: signTestToken(plainUser),
      body: cloneBody(source.id, `test-clone-authz-target-${uniqueSuffix()}`),
    });
    expect(status).toBe(403);
  });

  test("401 with no token at all", async () => {
    const { status } = await jsonRequest(port, "POST", "/api/admin/bingo/clone", {
      body: cloneBody("00000000-0000-0000-0000-000000000000", `test-clone-authz-none-${uniqueSuffix()}`),
    });
    expect(status).toBe(401);
  });

  test("400 for a malformed body (missing sourceBingoId)", async () => {
    const { status, body } = await jsonRequest(port, "POST", "/api/admin/bingo/clone", {
      token: signTestToken(admin),
      body: { name: "x", startDate: "2026-08-01T00:00:00.000Z", endDate: "2026-08-15T00:00:00.000Z" },
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});
