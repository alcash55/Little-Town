/**
 * POST /api/admin/bingo/:bingoId/end — TEAM-BRIEF.md Sprint 17, Track A1.
 * Frozen contract:
 *   200 { success: true, data: { id, status: "complete", endedAt, pendingScreenshots } }
 *   404 no such bingo
 *   409 { success: false, error: "Bingo is not active" }
 *
 * Two layers of coverage:
 *   1. Service-level (endBingoEarly, services/bingoLifecycle.ts) — same
 *      style as tests/integration/bingo-lifecycle.test.ts's coverage of
 *      completeEndedBingos, the sibling transition this shares its guarded
 *      UPDATE with. Discord is mocked throughout.
 *   2. Route-level (real HTTP against the mounted admin router) — 404, 409,
 *      the happy path, and non-admin/moderator 403s.
 *
 * Needs NO Sprint 17 Track A2 data-layer functions — A1 is fully
 * self-contained, so (once Docker/the local stack is available) every test
 * here should actually PASS, not just compile.
 */
process.env.JWT_SECRET = "bingo-end-early-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import express from "express";
import type http from "node:http";

import { errorHandler } from "../../src/middleware/errorHandler.js";
import adminRoutes from "../../src/routes/admin.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  getBingoRow,
  insertTestUser,
  deleteTestUser,
  signTestToken,
  jsonRequest,
  startTestServer,
  uniqueSuffix,
  withAllowDevAuth,
  type TestUser,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[bingo-end-early.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn("[bingo-end-early.test.ts] skipping: another bingo is already active in the shared local stack");
}
const suite = stack.reachable && !preexistingActive;

const notifyMock = mock(async (_bingoName: string, _pendingCount: number) => {});
mock.module("../../src/services/discordScreenshots.js", () => ({
  notifyBingoEndedWithPendingScreenshots: notifyMock,
}));

// Dynamically imported after the mock is registered (same reasoning as
// bingo-lifecycle.test.ts) so it resolves the mocked discordScreenshots.
const { endBingoEarly } = await import("../../src/services/bingoLifecycle.js");

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

  admin = await insertTestUser("admin", "EndEarly");
  plainUser = await insertTestUser("user", "EndEarly");
  moderator = await insertTestUser("moderator", "EndEarly");
  createdUserIds.push(admin.id, plainUser.id, moderator.id);
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
  await Promise.all(createdUserIds.map((id) => deleteTestUser(id)));
});

// -------------------------------------------------------
// Service-level: endBingoEarly()
// -------------------------------------------------------

describe.skipIf(!suite)("endBingoEarly (service)", () => {
  test("transitions an active bingo to complete, returns id/endedAt/pendingCount", async () => {
    const bingo = await insertTestBingo(`test-end-early-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const before = new Date();
    const result = await endBingoEarly(bingo.id, admin.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(bingo.id);
    expect(result!.pendingCount).toBe(0);
    expect(new Date(result!.endedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());

    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("complete");
  });

  test("returns null for a draft bingo (never transitions it)", async () => {
    const bingo = await insertTestBingo(`test-end-early-draft-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(bingo.id);

    const result = await endBingoEarly(bingo.id, admin.id);
    expect(result).toBeNull();

    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("draft");
  });

  test("returns null for an already-complete bingo (idempotent-safe, not re-processed)", async () => {
    const bingo = await insertTestBingo(`test-end-early-complete-${uniqueSuffix()}`, { status: "complete" });
    createdBingoIds.push(bingo.id);

    const result = await endBingoEarly(bingo.id, admin.id);
    expect(result).toBeNull();
  });

  test("returns null for a nonexistent bingo id", async () => {
    const result = await endBingoEarly("00000000-0000-0000-0000-000000000000", admin.id);
    expect(result).toBeNull();
  });
});

// -------------------------------------------------------
// Route-level: POST /api/admin/bingo/:bingoId/end
// -------------------------------------------------------

describe.skipIf(!suite)("POST /api/admin/bingo/:bingoId/end (route)", () => {
  test("404 for a bingo id that doesn't exist", async () => {
    const { status, body } = await jsonRequest(
      port,
      "POST",
      "/api/admin/bingo/00000000-0000-0000-0000-000000000000/end",
      { token: signTestToken(admin) },
    );
    expect(status).toBe(404);
    expect(body).toEqual({ success: false, error: "No such bingo" });
  });

  test("409 for a bingo that exists but isn't active (draft)", async () => {
    const bingo = await insertTestBingo(`test-end-early-route-draft-${uniqueSuffix()}`, { status: "draft" });
    createdBingoIds.push(bingo.id);

    const { status, body } = await jsonRequest(port, "POST", `/api/admin/bingo/${bingo.id}/end`, {
      token: signTestToken(admin),
    });
    expect(status).toBe(409);
    expect(body).toEqual({ success: false, error: "Bingo is not active" });
  });

  test("200 happy path for an active bingo — response shape matches the frozen contract, DB flips to complete", async () => {
    const bingo = await insertTestBingo(`test-end-early-route-active-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const { status, body } = await jsonRequest(port, "POST", `/api/admin/bingo/${bingo.id}/end`, {
      token: signTestToken(admin),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: bingo.id, status: "complete", pendingScreenshots: 0 });
    expect(typeof body.data.endedAt).toBe("string");

    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("complete");
  });

  test("a SECOND call against the now-complete bingo is 409, not a repeat 200 (idempotent-safe)", async () => {
    const bingo = await insertTestBingo(`test-end-early-route-idempotent-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const first = await jsonRequest(port, "POST", `/api/admin/bingo/${bingo.id}/end`, { token: signTestToken(admin) });
    expect(first.status).toBe(200);

    const second = await jsonRequest(port, "POST", `/api/admin/bingo/${bingo.id}/end`, { token: signTestToken(admin) });
    expect(second.status).toBe(409);
  });

  test("403 for a plain user", async () => {
    const bingo = await insertTestBingo(`test-end-early-authz-user-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const { status } = await jsonRequest(port, "POST", `/api/admin/bingo/${bingo.id}/end`, {
      token: signTestToken(plainUser),
    });
    expect(status).toBe(403);

    await deleteTestBingo(bingo.id);
    createdBingoIds.splice(createdBingoIds.indexOf(bingo.id), 1);
  });

  test("403 for a moderator — this route is admin-only despite the router-level admin+moderator gate", async () => {
    const bingo = await insertTestBingo(`test-end-early-authz-mod-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    const { status } = await jsonRequest(port, "POST", `/api/admin/bingo/${bingo.id}/end`, {
      token: signTestToken(moderator),
    });
    expect(status).toBe(403);

    await deleteTestBingo(bingo.id);
    createdBingoIds.splice(createdBingoIds.indexOf(bingo.id), 1);
  });

  test("401 with no token at all", async () => {
    const bingo = await insertTestBingo(`test-end-early-authz-none-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);

    // Deterministic regardless of the developer's local .env — see
    // withAllowDevAuth's doc comment (helpers.ts).
    const { status } = await withAllowDevAuth("false", () =>
      jsonRequest(port, "POST", `/api/admin/bingo/${bingo.id}/end`, {}),
    );
    expect(status).toBe(401);

    await deleteTestBingo(bingo.id);
    createdBingoIds.splice(createdBingoIds.indexOf(bingo.id), 1);
  });
});
