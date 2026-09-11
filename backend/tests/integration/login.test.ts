/**
 * Issue #52: nothing anywhere in the repo exercised POST /api/auth/login
 * before this file — the only door into the app had zero coverage. Covers
 * the success shape, the three failure paths named in the issue (wrong
 * password, unknown user, malformed/missing input), that the token never
 * appears in the response body (issue #53 — it's httpOnly-cookie-only now),
 * and the rate limiter already mounted on this route in index.ts.
 */
process.env.JWT_SECRET = "login-test-secret-do-not-use-elsewhere";

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import type http from "node:http";

import rateLimit from "express-rate-limit";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { loginLimiterOptions } from "../../src/middleware/loginLimiter.js";
import authRoutes from "../../src/routes/auth.js";
import { hashPassword } from "../../src/db/users.js";
import { getDb } from "../../src/db/client.js";
import { getLocalStackConfig, jsonRequest, startTestServer, uniqueSuffix } from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[login.test.ts] skipping: ${stack.reason}`);
}

const PASSWORD = "correct horse battery staple";
let server: http.Server;
let port: number;
let testUserId: string;
let testUsername: string;

beforeAll(async () => {
  if (!stack.reachable) return;

  // Deliberately NOT mounting the login rate limiter here — these tests only
  // assert response correctness, and sharing a limiter bucket across every
  // test in this describe block plus the dedicated rate-limit block below
  // would make the 429 test's own count depend on how many tests ran before
  // it. See the "rate limiting" describe block further down for that.
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  ({ server, port } = await startTestServer(app));

  testUsername = `LoginTest${uniqueSuffix()}`;
  const { data, error } = await getDb()
    .from("users")
    .insert({
      username: testUsername,
      email: `${testUsername}@example.test`,
      password_hash: await hashPassword(PASSWORD),
      role: "user",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to seed test user: ${error?.message}`);
  testUserId = data.id;
});

afterAll(async () => {
  server?.close();
  if (!stack.reachable || !testUserId) return;
  await getDb().from("users").delete().eq("id", testUserId);
});

describe.skipIf(!stack.reachable)("POST /api/auth/login", () => {
  test("correct credentials succeed: 200, user in the body, token only as an httpOnly cookie", async () => {
    const res = await jsonRequest(port, "POST", "/api/auth/login", {
      body: { username: testUsername, password: PASSWORD },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(testUserId);
    expect(res.body.data.user.username).toBe(testUsername);
    expect(res.body.data.expiresAt).toEqual(expect.any(String));

    // Issue #53: the JWT must never travel in the JSON body — only as the
    // httpOnly cookie asserted below.
    expect(res.body.data.token).toBeUndefined();
    expect(Object.keys(res.body.data).sort()).toEqual(["expiresAt", "user"]);

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
    expect(cookieHeader).toContain("authToken=");
    expect(cookieHeader.toLowerCase()).toContain("httponly");
    const tokenValue = cookieHeader.match(/authToken=([^;]+)/)?.[1];
    expect(tokenValue?.split(".").length).toBe(3); // header.payload.signature
  });

  test("wrong password: 401, no cookie set", async () => {
    const res = await jsonRequest(port, "POST", "/api/auth/login", {
      body: { username: testUsername, password: "not the password" },
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("unknown username: 401 (same shape as wrong password — doesn't leak which one was wrong)", async () => {
    const res = await jsonRequest(port, "POST", "/api/auth/login", {
      body: { username: `nobody-${uniqueSuffix()}`, password: PASSWORD },
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("missing password: 400", async () => {
    const res = await jsonRequest(port, "POST", "/api/auth/login", {
      body: { username: testUsername },
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("missing username: 400", async () => {
    const res = await jsonRequest(port, "POST", "/api/auth/login", {
      body: { password: PASSWORD },
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("empty body: 400", async () => {
    const res = await jsonRequest(port, "POST", "/api/auth/login", { body: {} });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// Separate describe block: this one exhausts the real limiter (max 10 per
// 15 min window, see loginLimiter.ts), so it needs its own server/limiter
// instance rather than sharing the bucket the tests above already spent
// requests against.
describe.skipIf(!stack.reachable)("POST /api/auth/login rate limiting", () => {
  let limitedServer: http.Server;
  let limitedPort: number;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    // A fresh instance built from the same options the real app uses
    // (loginLimiterOptions), not the shared singleton — see the comment on
    // loginLimiterOptions in loginLimiter.ts for why.
    app.use("/api/auth/login", rateLimit(loginLimiterOptions));
    app.use("/api/auth", authRoutes);
    app.use(errorHandler);
    ({ server: limitedServer, port: limitedPort } = await startTestServer(app));
  });

  afterAll(() => {
    limitedServer?.close();
  });

  test("the 11th attempt within the window is rejected with 429, independent of credentials", async () => {
    const attempt = () =>
      jsonRequest(limitedPort, "POST", "/api/auth/login", {
        body: { username: "whoever", password: "whatever" },
      });

    const results = [];
    for (let i = 0; i < 11; i++) {
      results.push(await attempt());
    }

    const statuses = results.map((r) => r.status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
