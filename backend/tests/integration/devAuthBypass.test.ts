/**
 * `protect`'s `ALLOW_DEV_AUTH` no-token bypass (middleware/auth.ts) — a
 * request with no bearer token is accepted and treated as the local-dev
 * admin user (`LOCAL_DEV_USER_ID`) when `ALLOW_DEV_AUTH=true`, instead of
 * being rejected. This is load-bearing for local development (`bun run dev`
 * without ever logging in — see `.env.example`) and was previously
 * completely untested. That's the same class of gap that let the Board
 * Builder empty-board bug hide for as long as it did (todo.md: "anything
 * that assumes `localStorage.authToken` exists behaves differently under
 * `bun dev`'s auth bypass than in prod") — the bypass path silently diverges
 * from production auth, and nothing here caught it.
 *
 * This file pins BOTH directions explicitly:
 *   - ALLOW_DEV_AUTH=true  -> no-token request succeeds, as the dev admin.
 *   - ALLOW_DEV_AUTH=false -> the SAME no-token request is rejected (401) —
 *     the bypass is opt-in, never a fallback default.
 *
 * Every other integration test file's "401 with no token" assertions use
 * withAllowDevAuth("false", ...) (helpers.ts) for exactly the determinism
 * this file is now dedicated to proving works both ways.
 */
process.env.JWT_SECRET = "dev-auth-bypass-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import type http from "node:http";

import { errorHandler } from "../../src/middleware/errorHandler.js";
import adminRoutes from "../../src/routes/admin.js";
import {
  getLocalStackConfig,
  jsonRequest,
  startTestServer,
  withAllowDevAuth,
  insertTestUser,
  deleteTestUser,
  signTestToken,
  type TestUser,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[devAuthBypass.test.ts] skipping: ${stack.reason}`);
}

let server: http.Server;
let port: number;
let plainUser: TestUser;
const createdUserIds: string[] = [];

beforeAll(async () => {
  if (!stack.reachable) return;

  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  app.use(errorHandler);
  ({ server, port } = await startTestServer(app));

  plainUser = await insertTestUser("user", "DevBypass");
  createdUserIds.push(plainUser.id);
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable) return;
  await Promise.all(createdUserIds.map((id) => deleteTestUser(id)));
});

describe.skipIf(!stack.reachable)("protect's ALLOW_DEV_AUTH no-token bypass", () => {
  test("ALLOW_DEV_AUTH=true: a no-token request is accepted and treated as the local-dev admin user", async () => {
    const { status, body } = await withAllowDevAuth("true", () => jsonRequest(port, "GET", "/api/admin/bingo", {}));

    // GET /api/admin/bingo is authorize("admin")-gated — a 200 here proves
    // the injected user actually carries role "admin", not just "some user".
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("ALLOW_DEV_AUTH unset: the SAME no-token request is rejected (bypass is opt-in, not a default)", async () => {
    const { status } = await withAllowDevAuth(undefined, () => jsonRequest(port, "GET", "/api/admin/bingo", {}));
    expect(status).toBe(401);
  });

  test("ALLOW_DEV_AUTH=false: the SAME no-token request is rejected (explicit false isn't loosely truthy)", async () => {
    const { status } = await withAllowDevAuth("false", () => jsonRequest(port, "GET", "/api/admin/bingo", {}));
    expect(status).toBe(401);
  });

  test("a real token still wins over the bypass — a non-admin caller is NOT silently promoted to the dev admin", async () => {
    // Even with the bypass enabled, a request that DOES carry a token must
    // be evaluated as that token's real user, not upgraded to the dev
    // admin — the bypass only ever fires for a MISSING token, never as a
    // way to escalate a real caller's role.
    const { status } = await withAllowDevAuth("true", () =>
      jsonRequest(port, "GET", "/api/admin/bingo", { token: signTestToken(plainUser) }),
    );
    expect(status).toBe(403);
  });
});
