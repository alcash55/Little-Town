/**
 * GET/DELETE/PATCH /api/admin/rsn-claims(/:rsnNormalized) — TEAM-BRIEF.md
 * Sprint 17, Track A4. Frozen contract:
 *   GET    /api/admin/rsn-claims                → { success: true, data: [{ userId, username, rsn, rsnNormalized, claimedAt }] }
 *   DELETE /api/admin/rsn-claims/:rsnNormalized → { success: true, data: { released: true } }
 *   PATCH  /api/admin/rsn-claims/:rsnNormalized  body { userId } → { success: true, data: { rsn, userId } }
 *     409 on reassign if the target user already holds a different claim
 *
 * DELETE's 404 (no such claim) is MY route's own `{ success: false, error }`
 * (db/rsnClaims.ts's releaseRsnClaim returns a plain boolean). PATCH's
 * 404/409 come from db/rsnClaims.ts's reassignRsnClaim, which throws
 * AppError and is forwarded through errorHandler untouched — those two
 * responses render as `{ error, code }`, not `{ success: false, error }`
 * (flagged in the sprint report).
 *
 * Against the live local Supabase stack.
 */
process.env.JWT_SECRET = "rsn-claims-admin-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import type http from "node:http";

import { errorHandler } from "../../src/middleware/errorHandler.js";
import adminRoutes from "../../src/routes/admin.js";
import { getDb } from "../../src/db/client.js";
import { upsertRsnClaim } from "../../src/db/rsnClaims.js";
import {
  getLocalStackConfig,
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
  console.warn(`[rsn-claims-admin.test.ts] skipping: ${stack.reason}`);
}
const suite = stack.reachable;

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

  admin = await insertTestUser("admin", "RsnClaims");
  plainUser = await insertTestUser("user", "RsnClaims");
  createdUserIds.push(admin.id, plainUser.id);
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  await Promise.all(createdUserIds.map((id) => deleteTestUser(id)));
});

async function claimExists(rsnNormalized: string): Promise<boolean> {
  const { data } = await getDb().from("rsn_claims").select("id").eq("rsn_normalized", rsnNormalized).maybeSingle();
  return data !== null;
}

describe.skipIf(!suite)("GET /api/admin/rsn-claims", () => {
  test("lists claims joined to username, 403 for a plain user", async () => {
    const claimant = await insertTestUser("user", "RsnClaimant");
    createdUserIds.push(claimant.id);
    const rsn = `ClaimTest${uniqueSuffix()}`;
    const rsnNormalized = rsn.toLowerCase();
    await upsertRsnClaim(claimant.id, rsn, rsnNormalized);

    const admin200 = await jsonRequest(port, "GET", "/api/admin/rsn-claims", { token: signTestToken(admin) });
    expect(admin200.status).toBe(200);
    expect(admin200.body.success).toBe(true);
    expect(Array.isArray(admin200.body.data)).toBe(true);
    const row = admin200.body.data.find((r: any) => r.rsnNormalized === rsnNormalized);
    expect(row).toMatchObject({ userId: claimant.id, username: claimant.username, rsn, rsnNormalized });
    expect(typeof row.claimedAt).toBe("string");

    const user403 = await jsonRequest(port, "GET", "/api/admin/rsn-claims", { token: signTestToken(plainUser) });
    expect(user403.status).toBe(403);
  });

  test("401 with no token at all", async () => {
    // Deterministic regardless of the developer's local .env — see
    // withAllowDevAuth's doc comment (helpers.ts).
    const { status } = await withAllowDevAuth("false", () =>
      jsonRequest(port, "GET", "/api/admin/rsn-claims", {}),
    );
    expect(status).toBe(401);
  });
});

describe.skipIf(!suite)("DELETE /api/admin/rsn-claims/:rsnNormalized", () => {
  test("200 releases an existing claim — actually deletes the row", async () => {
    const claimant = await insertTestUser("user", "RsnRelease");
    createdUserIds.push(claimant.id);
    const rsn = `ReleaseTest${uniqueSuffix()}`;
    const rsnNormalized = rsn.toLowerCase();
    await upsertRsnClaim(claimant.id, rsn, rsnNormalized);
    expect(await claimExists(rsnNormalized)).toBe(true);

    const { status, body } = await jsonRequest(port, "DELETE", `/api/admin/rsn-claims/${rsnNormalized}`, {
      token: signTestToken(admin),
    });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, data: { released: true } });
    expect(await claimExists(rsnNormalized)).toBe(false);
  });

  test("404 for an rsnNormalized with no existing claim — this route's own { success: false, error }", async () => {
    const { status, body } = await jsonRequest(
      port,
      "DELETE",
      `/api/admin/rsn-claims/no-such-claim-${uniqueSuffix()}`,
      { token: signTestToken(admin) },
    );
    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
  });

  test("403 for a plain user", async () => {
    const { status } = await jsonRequest(port, "DELETE", `/api/admin/rsn-claims/whatever-${uniqueSuffix()}`, {
      token: signTestToken(plainUser),
    });
    expect(status).toBe(403);
  });
});

describe.skipIf(!suite)("PATCH /api/admin/rsn-claims/:rsnNormalized", () => {
  test("200 reassigns an existing claim to a new user with no prior claim", async () => {
    const originalOwner = await insertTestUser("user", "RsnReassignFrom");
    const newOwner = await insertTestUser("user", "RsnReassignTo");
    createdUserIds.push(originalOwner.id, newOwner.id);
    const rsn = `ReassignTest${uniqueSuffix()}`;
    const rsnNormalized = rsn.toLowerCase();
    await upsertRsnClaim(originalOwner.id, rsn, rsnNormalized);

    const { status, body } = await jsonRequest(port, "PATCH", `/api/admin/rsn-claims/${rsnNormalized}`, {
      token: signTestToken(admin),
      body: { userId: newOwner.id },
    });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, data: { rsn, userId: newOwner.id } });

    const { data: row } = await getDb().from("rsn_claims").select("user_id").eq("rsn_normalized", rsnNormalized).single();
    expect(row.user_id).toBe(newOwner.id);
  });

  test("404 for an rsnNormalized with no existing claim — forwarded AppError, { error, code } shape", async () => {
    const { newOwner } = { newOwner: plainUser };
    const { status, body } = await jsonRequest(
      port,
      "PATCH",
      `/api/admin/rsn-claims/no-such-claim-${uniqueSuffix()}`,
      { token: signTestToken(admin), body: { userId: newOwner.id } },
    );
    expect(status).toBe(404);
    expect(body.code).toBe("RSN_CLAIM_NOT_FOUND");
  });

  test("409 if the target user already holds a DIFFERENT claim", async () => {
    const ownerA = await insertTestUser("user", "RsnConflictA");
    const ownerB = await insertTestUser("user", "RsnConflictB");
    createdUserIds.push(ownerA.id, ownerB.id);
    const rsnA = `ConflictA${uniqueSuffix()}`;
    const rsnB = `ConflictB${uniqueSuffix()}`;
    await upsertRsnClaim(ownerA.id, rsnA, rsnA.toLowerCase());
    await upsertRsnClaim(ownerB.id, rsnB, rsnB.toLowerCase());

    // Try to reassign rsnA's claim to ownerB, who already holds rsnB.
    const { status, body } = await jsonRequest(port, "PATCH", `/api/admin/rsn-claims/${rsnA.toLowerCase()}`, {
      token: signTestToken(admin),
      body: { userId: ownerB.id },
    });
    expect(status).toBe(409);
    expect(body.code).toBe("RSN_CLAIM_CONFLICT");

    // Original claim must be untouched.
    const { data: row } = await getDb().from("rsn_claims").select("user_id").eq("rsn_normalized", rsnA.toLowerCase()).single();
    expect(row.user_id).toBe(ownerA.id);
  });

  test("403 for a plain user", async () => {
    const { status } = await jsonRequest(port, "PATCH", `/api/admin/rsn-claims/whatever-${uniqueSuffix()}`, {
      token: signTestToken(plainUser),
      body: { userId: plainUser.id },
    });
    expect(status).toBe(403);
  });

  test("400 for a missing userId in the body", async () => {
    const { status, body } = await jsonRequest(port, "PATCH", `/api/admin/rsn-claims/whatever-${uniqueSuffix()}`, {
      token: signTestToken(admin),
      body: {},
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});
