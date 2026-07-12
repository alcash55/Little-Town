/**
 * Impersonation middleware (TEAM-BRIEF.md Sprint 6, Track A item 2) —
 * `protect`'s applyImpersonation step and `authorizeReal`.
 *
 * Spins up a real (ephemeral, loopback-only) HTTP server with a few tiny
 * test-only routes so the actual Express middleware chain runs end to end —
 * a call-the-function-directly unit test wouldn't exercise header parsing,
 * `next()` wiring, or errorHandler's status-code mapping. Uses real rows in
 * the local stack's `users` table (rather than mocking src/db/users.js,
 * which other test files in this same `bun test` process also import —
 * mock.module persists process-wide, so mocking a shared module here could
 * leak into unrelated test files) and real JWTs signed with a fixed
 * test-only JWT_SECRET.
 *
 * Uses node:http directly for the test client for the same reason
 * tests/unit/hiscoresRateLimit.test.ts does: other files in this suite stub
 * globalThis.fetch permanently and bun runs every test file in one process.
 */
process.env.JWT_SECRET = "impersonation-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { protect, authorize, authorizeReal } from "../../src/middleware/auth.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { getLocalStackConfig, uniqueSuffix } from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[impersonation.test.ts] skipping: ${stack.reason}`);
}

interface TestUser {
  id: string;
  username: string;
  role: "user" | "admin" | "moderator";
}

const createdUserIds: string[] = [];

async function insertTestUser(role: TestUser["role"]): Promise<TestUser> {
  const username = `ImperTest${role}${uniqueSuffix()}`;
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
let warnLog: string[] = [];
const originalWarn = console.warn;

function request(
  path: string,
  token: string,
  impersonateId?: string,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (impersonateId !== undefined) headers["X-Impersonate-User-Id"] = impersonateId;
    http
      .get({ host: "127.0.0.1", port, path, headers }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(body) }));
      })
      .on("error", reject);
  });
}

beforeAll(async () => {
  if (!stack.reachable) return;

  const app = express();
  app.get("/echo", protect, (req, res) => {
    res.json({ userId: req.user!.id, userRole: req.user!.role, realUserId: req.realUser?.id ?? null });
  });
  app.get("/admin-only", protect, authorize("admin"), (req, res) => {
    res.json({ ok: true, userId: req.user!.id });
  });
  app.get("/admin-real-only", protect, authorizeReal("admin"), (req, res) => {
    res.json({ ok: true, userId: req.user!.id, realUserId: req.realUser?.id ?? null });
  });
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server?.close();
  console.warn = originalWarn;
  if (!stack.reachable) return;
  await Promise.all(
    createdUserIds.map((id) => getDb().from("users").delete().eq("id", id).then(() => undefined, () => undefined)),
  );
});

describe.skipIf(!stack.reachable)("impersonation middleware", () => {
  let admin: TestUser;
  let otherAdmin: TestUser;
  let plainUser: TestUser;
  let moderator: TestUser;

  test("fixtures: two admins, a plain user, a moderator", async () => {
    admin = await insertTestUser("admin");
    otherAdmin = await insertTestUser("admin");
    plainUser = await insertTestUser("user");
    moderator = await insertTestUser("moderator");
  });

  test("no header: caller sees their own identity, realUser matches user", async () => {
    const { status, body } = await request("/echo", signToken(admin));
    expect(status).toBe(200);
    expect(body.userId).toBe(admin.id);
    expect(body.realUserId).toBe(admin.id);
  });

  test("admin + header for a plain user: req.user swaps to the target", async () => {
    warnLog = [];
    console.warn = (...args: unknown[]) => warnLog.push(args.join(" "));

    const { status, body } = await request("/echo", signToken(admin), plainUser.id);
    expect(status).toBe(200);
    expect(body.userId).toBe(plainUser.id);
    expect(body.userRole).toBe("user");
    expect(body.realUserId).toBe(admin.id);

    expect(warnLog.some((l) => l === `[impersonation] admin ${admin.id} as ${plainUser.id} GET /echo`)).toBe(
      true,
    );
    console.warn = originalWarn;
  });

  test("admin impersonating a plain user loses access to admin-only routes (sees what the user sees)", async () => {
    const { status } = await request("/admin-only", signToken(admin), plainUser.id);
    expect(status).toBe(403);
  });

  test("admin impersonating a plain user keeps access to the real-caller-gated route", async () => {
    const { status, body } = await request("/admin-real-only", signToken(admin), plainUser.id);
    expect(status).toBe(200);
    expect(body.realUserId).toBe(admin.id);
  });

  test("admin + header for ANOTHER admin: blocked with 403, req.user is not swapped", async () => {
    const { status, body } = await request("/echo", signToken(admin), otherAdmin.id);
    expect(status).toBe(403);
    expect(body.error).toMatch(/cannot impersonate another admin/i);
  });

  test("an admin CAN impersonate themselves (no-op, not a self-block)", async () => {
    const { status, body } = await request("/echo", signToken(admin), admin.id);
    expect(status).toBe(200);
    expect(body.userId).toBe(admin.id);
  });

  test("admin + header for a nonexistent user id: 400, distinct from the admin-block case", async () => {
    const { status, body } = await request(
      "/echo",
      signToken(admin),
      "00000000-1111-2222-3333-444444444444",
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/impersonation target not found/i);
  });

  test("non-admin + header: ignored, request proceeds as the real (non-admin) caller", async () => {
    warnLog = [];
    console.warn = (...args: unknown[]) => warnLog.push(args.join(" "));

    const { status, body } = await request("/echo", signToken(plainUser), admin.id);
    expect(status).toBe(200);
    expect(body.userId).toBe(plainUser.id); // NOT swapped to admin.id
    expect(body.realUserId).toBe(plainUser.id);
    expect(warnLog.length).toBe(0); // no impersonation actually happened -> no log line

    console.warn = originalWarn;
  });

  test("non-admin + header hitting an admin-only route still gets a plain 403 (header grants nothing)", async () => {
    const { status } = await request("/admin-only", signToken(plainUser), admin.id);
    expect(status).toBe(403);
  });

  test("moderator + header: also ignored (only 'admin' may impersonate)", async () => {
    const { status, body } = await request("/echo", signToken(moderator), plainUser.id);
    expect(status).toBe(200);
    expect(body.userId).toBe(moderator.id);
  });
});
