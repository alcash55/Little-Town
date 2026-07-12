/**
 * Regression coverage for the /api/admin/* mount ORDER in src/index.ts.
 *
 * admin.ts (adminRoutes) applies `protect` + `authorize("admin",
 * "moderator")` at the ROUTER level — i.e. to every request under whatever
 * prefix it's mounted at, whether or not any of its own routes match.
 * Express tries app.use() mounts in registration order, so if adminRoutes
 * were registered before the more specific /api/admin/invites and
 * /api/admin/users routers, a request to those paths would hit adminRoutes'
 * blanket gate FIRST — evaluated against the (possibly impersonation-
 * swapped) req.user — before ever reaching adminUsersRoutes' own
 * `authorizeReal("admin")`. That would silently defeat the whole point of
 * authorizeReal: an admin currently impersonating a plain user would get
 * 403'd by admin.ts's blanket check and never reach the users-list route at
 * all. index.ts registers the specific routers first for exactly this
 * reason — this test builds the same three routers in the same order and
 * proves the impersonating-admin case actually reaches authorizeReal.
 */
process.env.JWT_SECRET = "admin-route-mounting-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { adminInviteRoutes, publicInviteRoutes } from "../../src/routes/invites.js";
import { adminUsersRoutes } from "../../src/routes/adminUsers.js";
import adminRoutes from "../../src/routes/admin.js";
import { getLocalStackConfig, uniqueSuffix } from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[adminRouteMounting.test.ts] skipping: ${stack.reason}`);
}

interface TestUser {
  id: string;
  username: string;
  role: "user" | "admin" | "moderator";
}

const createdUserIds: string[] = [];

async function insertTestUser(role: TestUser["role"]): Promise<TestUser> {
  const username = `MountTest${role}${uniqueSuffix()}`;
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

function request(path: string, token: string, impersonateId?: string): Promise<{ status: number; body: any }> {
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

  // Mirrors src/index.ts's mount order exactly.
  const app = express();
  app.use("/api/admin/invites", adminInviteRoutes);
  app.use("/api/admin/users", adminUsersRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/invites", publicInviteRoutes);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  await Promise.all(
    createdUserIds.map((id) => getDb().from("users").delete().eq("id", id).then(() => undefined, () => undefined)),
  );
});

describe.skipIf(!stack.reachable)("/api/admin/* mount order", () => {
  let admin: TestUser;
  let plainUser: TestUser;

  test("fixtures", async () => {
    admin = await insertTestUser("admin");
    plainUser = await insertTestUser("user");
  });

  test("GET /api/admin/users works normally for an admin (not shadowed by adminRoutes)", async () => {
    const { status, body } = await request("/api/admin/users", signToken(admin));
    expect(status).toBe(200);
    expect(Array.isArray(body.users)).toBe(true);
  });

  test("GET /api/admin/invites works normally for an admin (not shadowed by adminRoutes)", async () => {
    const { status, body } = await request("/api/admin/invites", signToken(admin));
    expect(status).toBe(200);
    expect(Array.isArray(body.invites)).toBe(true);
  });

  test("an admin impersonating a plain user can STILL list users (authorizeReal reaches the real gate)", async () => {
    const { status, body } = await request("/api/admin/users", signToken(admin), plainUser.id);
    expect(status).toBe(200);
    expect(Array.isArray(body.users)).toBe(true);
  });

  test("an admin impersonating a plain user is locked out of ordinary admin.ts routes", async () => {
    const { status } = await request("/api/admin/bingo", signToken(admin), plainUser.id);
    expect(status).toBe(403);
  });

  test("a plain user (no impersonation) is rejected by both the specific and generic admin routers", async () => {
    const usersResult = await request("/api/admin/users", signToken(plainUser));
    expect(usersResult.status).toBe(403);

    const invitesResult = await request("/api/admin/invites", signToken(plainUser));
    expect(invitesResult.status).toBe(403);
  });
});
