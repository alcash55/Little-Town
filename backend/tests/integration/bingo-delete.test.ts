/**
 * DELETE /api/admin/bingo/:bingoId — TEAM-BRIEF.md Sprint 17, Track A2. The
 * only destructive endpoint in the codebase. Frozen contract:
 *   200 { success: true, data: { deleted: true, id, purged: {...} } }
 *   404 no such bingo
 *   409 { success: false, error: "Refusing to delete an active bingo", code: "BINGO_ACTIVE" }
 *
 * The double guard (body force:true AND header X-Confirm-Delete matching
 * the bingo's name) is tested as two INDEPENDENT halves per the sprint
 * instructions — force alone must block, the header alone must block,
 * neither substitutes for the other.
 *
 * All against the live local Supabase stack (no mocking of the delete
 * path) — a cascade delete is exactly the class of bug mocks can't catch.
 */
process.env.JWT_SECRET = "bingo-delete-test-secret-do-not-use-elsewhere";

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
  insertTestTeam,
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
  console.warn(`[bingo-delete.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn("[bingo-delete.test.ts] skipping: another bingo is already active in the shared local stack");
}
const suite = stack.reachable && !preexistingActive;

const createdBingoIds: string[] = [];
const createdUserIds: string[] = [];

let server: http.Server;
let port: number;
let admin: TestUser;
let plainUser: TestUser;
let moderator: TestUser;

beforeAll(async () => {
  if (!suite) return;

  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  app.use(errorHandler);
  ({ server, port } = await startTestServer(app));

  admin = await insertTestUser("admin", "Delete");
  plainUser = await insertTestUser("user", "Delete");
  moderator = await insertTestUser("moderator", "Delete");
  createdUserIds.push(admin.id, plainUser.id, moderator.id);
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
  await Promise.all(createdUserIds.map((id) => deleteTestUser(id)));
});

async function bingoRowExists(id: string): Promise<boolean> {
  const { data } = await getDb().from("bingos").select("id").eq("id", id).maybeSingle();
  return data !== null;
}

describe.skipIf(!suite)("DELETE /api/admin/bingo/:bingoId", () => {
  test("404 for a bingo id that doesn't exist", async () => {
    const { status, body } = await jsonRequest(
      port,
      "DELETE",
      "/api/admin/bingo/00000000-0000-0000-0000-000000000000",
      { token: signTestToken(admin), body: {} },
    );
    expect(status).toBe(404);
    expect(body).toEqual({ success: false, error: "No such bingo" });
  });

  test("200 happy path for a DRAFT bingo — no guard applies, deletes and cascades, correct purge counts", async () => {
    const bingo = await insertTestBingo(`test-delete-draft-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(bingo.id);
    await insertTestTeam(bingo.id, "Team A");
    await insertTestTeam(bingo.id, "Team B");
    await insertTestTile(bingo.id, { position: 0 });
    await insertTestTile(bingo.id, { position: 1 });
    await insertTestTile(bingo.id, { position: 2 });

    const { status, body } = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, {
      token: signTestToken(admin),
      body: {},
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      deleted: true,
      id: bingo.id,
      purged: { teams: 2, tiles: 3, players: 0, submissions: 0, storageObjects: 0 },
    });

    expect(await bingoRowExists(bingo.id)).toBe(false);
    createdBingoIds.splice(createdBingoIds.indexOf(bingo.id), 1); // already gone, don't try to clean up again
  });

  // -------------------------------------------------------
  // The double guard, each half proven independently
  // -------------------------------------------------------

  test("GUARD half 1: force:true alone (no X-Confirm-Delete header) is refused with 409 on an active bingo", async () => {
    const bingo = await insertTestBingo(`test-delete-guard-force-only-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const { status, body } = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, {
      token: signTestToken(admin),
      body: { force: true },
      // deliberately NO X-Confirm-Delete header
    });
    expect(status).toBe(409);
    expect(body).toEqual({ success: false, error: "Refusing to delete an active bingo", code: "BINGO_ACTIVE" });

    // Bingo must still exist — the guard actually blocked the delete, not just the response.
    expect(await bingoRowExists(bingo.id)).toBe(true);

    // Free the one-active-bingo slot for the next guard test (raw cleanup,
    // not via the route under test — the route correctly refused to delete
    // this while it's active, which is exactly what this test just proved).
    await deleteTestBingo(bingo.id);
    createdBingoIds.splice(createdBingoIds.indexOf(bingo.id), 1);
  });

  test("GUARD half 2: correct X-Confirm-Delete header alone (force missing/false) is refused with 409 on an active bingo", async () => {
    const bingo = await insertTestBingo(`test-delete-guard-header-only-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const { status, body } = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, {
      token: signTestToken(admin),
      body: {}, // no force
      headers: { "X-Confirm-Delete": bingo.name },
    });
    expect(status).toBe(409);
    expect(body).toEqual({ success: false, error: "Refusing to delete an active bingo", code: "BINGO_ACTIVE" });
    expect(await bingoRowExists(bingo.id)).toBe(true);

    // Also prove force: false explicitly (not just absent) is still refused.
    const explicitFalse = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, {
      token: signTestToken(admin),
      body: { force: false },
      headers: { "X-Confirm-Delete": bingo.name },
    });
    expect(explicitFalse.status).toBe(409);
    expect(await bingoRowExists(bingo.id)).toBe(true);

    await deleteTestBingo(bingo.id);
    createdBingoIds.splice(createdBingoIds.indexOf(bingo.id), 1);
  });

  test("GUARD: a WRONG X-Confirm-Delete value (mismatched name) plus force:true is still refused", async () => {
    const bingo = await insertTestBingo(`test-delete-guard-wrong-header-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const { status, body } = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, {
      token: signTestToken(admin),
      body: { force: true },
      headers: { "X-Confirm-Delete": "Not The Real Bingo Name" },
    });
    expect(status).toBe(409);
    expect(body.code).toBe("BINGO_ACTIVE");
    expect(await bingoRowExists(bingo.id)).toBe(true);

    await deleteTestBingo(bingo.id);
    createdBingoIds.splice(createdBingoIds.indexOf(bingo.id), 1);
  });

  test("BOTH halves together on an active bingo succeed (200) and actually delete it", async () => {
    const bingo = await insertTestBingo(`test-delete-guard-both-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const { status, body } = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, {
      token: signTestToken(admin),
      body: { force: true },
      headers: { "X-Confirm-Delete": bingo.name },
    });
    expect(status).toBe(200);
    expect(body.data.deleted).toBe(true);
    expect(await bingoRowExists(bingo.id)).toBe(false);
    createdBingoIds.splice(createdBingoIds.indexOf(bingo.id), 1);
  });

  // -------------------------------------------------------
  // Authz
  // -------------------------------------------------------

  test("403 for a plain user", async () => {
    const bingo = await insertTestBingo(`test-delete-authz-user-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(bingo.id);

    const { status } = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, {
      token: signTestToken(plainUser),
      body: {},
    });
    expect(status).toBe(403);
    expect(await bingoRowExists(bingo.id)).toBe(true);
  });

  test("403 for a moderator — admin-only despite the router-level admin+moderator gate", async () => {
    const bingo = await insertTestBingo(`test-delete-authz-mod-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(bingo.id);

    const { status } = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, {
      token: signTestToken(moderator),
      body: {},
    });
    expect(status).toBe(403);
    expect(await bingoRowExists(bingo.id)).toBe(true);
  });

  test("401 with no token at all", async () => {
    const bingo = await insertTestBingo(`test-delete-authz-none-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(bingo.id);

    const { status } = await jsonRequest(port, "DELETE", `/api/admin/bingo/${bingo.id}`, { body: {} });
    expect(status).toBe(401);
    expect(await bingoRowExists(bingo.id)).toBe(true);
  });
});
