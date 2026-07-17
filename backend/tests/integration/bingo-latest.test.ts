/**
 * GET /api/admin/bingo/latest (TEAM-BRIEF.md Sprint 15, Track A frozen
 * contract): `{ success, data: { bingo: BingoConfig | null, pendingScreenshots: number } }`
 * — the most recent bingo REGARDLESS of status, plus its pending-submission
 * count. Real Express app + real admin.ts router against the local stack,
 * same technique as tests/integration/approve-requires-player.test.ts.
 *
 * The exact "no bingo has ever been created -> bingo: null" case is proven
 * in isolation in tests/unit/getLatestBingo.test.ts (the shared local stack
 * can't reliably be asserted empty here — TEAM-BRIEF.md Environment: "No
 * supabase db reset"). This file proves the route's real shape, auth, the
 * pendingScreenshots count, and that a 'complete' bingo is actually
 * returned (not hidden behind an active-only filter).
 */
process.env.JWT_SECRET = "bingo-latest-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import adminRoutes from "../../src/routes/admin.js";
import { insertPendingSubmission } from "../../src/db/bingoSubmissions.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[bingo-latest.test.ts] skipping: ${stack.reason}`);
}
const suite = stack.reachable;

interface TestUser {
  id: string;
  username: string;
  role: "user" | "admin" | "moderator";
}

const createdBingoIds: string[] = [];
const createdUserIds: string[] = [];

async function insertTestUser(role: TestUser["role"]): Promise<TestUser> {
  const username = `LatestTest${role}${uniqueSuffix()}`;
  const { data, error } = await getDb()
    .from("users")
    .insert({ username, password_hash: "x", role })
    .select("id, username, role")
    .single();
  if (error || !data) throw new Error(`Failed to insert test user "${username}": ${error?.message}`);
  createdUserIds.push((data as { id: string }).id);
  return data as TestUser;
}

function signToken(user: TestUser): string {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, getJwtSecret(), {
    expiresIn: "1h",
  });
}

let server: http.Server;
let port: number;

function getJson(path: string, token: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path, headers: { Authorization: `Bearer ${token}` } }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(body || "{}") }));
      })
      .on("error", reject);
  });
}

beforeAll(async () => {
  if (!suite) return;
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
  await Promise.all(
    createdUserIds.map((id) => getDb().from("users").delete().eq("id", id).then(() => undefined, () => undefined)),
  );
});

describe.skipIf(!suite)("GET /api/admin/bingo/latest", () => {
  let admin: TestUser;
  let moderator: TestUser;
  let plainUser: TestUser;

  test("fixtures: admin, moderator, plain user", async () => {
    admin = await insertTestUser("admin");
    moderator = await insertTestUser("moderator");
    plainUser = await insertTestUser("user");
  });

  test("a plain user is rejected (403) — same authz as the rest of this router", async () => {
    const res = await getJson("/api/admin/bingo/latest", signToken(plainUser));
    expect(res.status).toBe(403);
  });

  describe("with a status='complete' bingo (the whole point of this endpoint vs. /bingo/details)", () => {
    let bingo: BingoRow;

    test("fixtures: a bingo created directly as 'complete', with 2 pending screenshot submissions", async () => {
      bingo = await insertTestBingo(`test-latest-complete-${uniqueSuffix()}`, {
        status: "complete",
        end_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
      createdBingoIds.push(bingo.id);

      const msg1 = `latest-${uniqueSuffix()}`;
      const msg2 = `latest-${uniqueSuffix()}`;
      await insertPendingSubmission({ bingoId: bingo.id, discordMessageId: msg1, imagePath: `test/${msg1}.png` });
      await insertPendingSubmission({ bingoId: bingo.id, discordMessageId: msg2, imagePath: `test/${msg2}.png` });
    });

    test("admin sees the frozen contract shape: bingo (status='complete') + correct pendingScreenshots count", async () => {
      const res = await getJson("/api/admin/bingo/latest", signToken(admin));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bingo.id).toBe(bingo.id);
      expect(res.body.data.bingo.status).toBe("complete");
      expect(res.body.data.pendingScreenshots).toBe(2);
    });

    test("moderator has the same access as admin (contract: admin+moderator)", async () => {
      const res = await getJson("/api/admin/bingo/latest", signToken(moderator));
      expect(res.status).toBe(200);
      expect(res.body.data.bingo.id).toBe(bingo.id);
    });

    test("a newer bingo (even a bare draft) supersedes the complete one as 'latest'", async () => {
      const newer = await insertTestBingo(`test-latest-newer-draft-${uniqueSuffix()}`);
      createdBingoIds.push(newer.id);

      const res = await getJson("/api/admin/bingo/latest", signToken(admin));
      expect(res.status).toBe(200);
      expect(res.body.data.bingo.id).toBe(newer.id);
      expect(res.body.data.bingo.status).toBe("draft");
      // The newer draft has no submissions of its own.
      expect(res.body.data.pendingScreenshots).toBe(0);

      await deleteTestBingo(newer.id);
    });
  });
});
