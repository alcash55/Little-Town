/**
 * General `/api/` rate limiter keying (TEAM-BRIEF.md Sprint 16, Track C):
 * an authenticated caller gets a bucket keyed by user id instead of IP, so
 * several admins sharing one office/VPN IP no longer drain a single shared
 * bucket amongst themselves. Spins up a real (ephemeral, loopback-only)
 * HTTP server with the actual `rateLimitKey` generator wired into a real
 * `express-rate-limit` instance — same pattern as
 * tests/unit/hiscoresRateLimit.test.ts — so bucket isolation is exercised
 * end-to-end rather than just asserted against rateLimitKey's return value
 * in isolation. JWT signing/verification is exercised for real against a
 * fixed test-only secret; no DB or OSRS network calls are involved.
 *
 * A fresh server (and therefore a fresh in-memory rate-limit store) is
 * created per test via beforeEach/afterEach so bucket state never bleeds
 * across tests — deliberately not the shared beforeAll/afterAll pattern
 * hiscoresRateLimit.test.ts uses, since these tests share the *same* IP
 * fallback bucket with each other whenever a token is absent/invalid, and
 * would otherwise interfere with each other's counts.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import http from "node:http";
import type { AddressInfo } from "node:net";

process.env.JWT_SECRET = "rate-limit-identity-test-secret-do-not-use-elsewhere";

const { rateLimitKey } = await import("../../src/middleware/rateLimitKey.js");

const MAX_PER_WINDOW = 2;

let server: http.Server;
let port: number;

function get(path: string, token?: string): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    http
      .get(
        {
          host: "127.0.0.1",
          port,
          path,
          headers: token ? { authorization: `Bearer ${token}` } : {},
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
        },
      )
      .on("error", reject);
  });
}

function signToken(id: string, secret: string = process.env.JWT_SECRET!): string {
  return jwt.sign({ id, username: id, role: "member" }, secret, { expiresIn: "1h" });
}

beforeEach(async () => {
  const app = express();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: MAX_PER_WINDOW,
    keyGenerator: rateLimitKey,
    message: { error: "Too many requests" },
  });
  app.use("/api/", limiter);
  app.get("/api/ping", (_req, res) => res.status(200).json({ ok: true }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("rate limiter keying — identity vs IP (TEAM-BRIEF.md Track C)", () => {
  test("two authenticated callers with different valid tokens from the same IP get independent buckets", async () => {
    const tokenA = signToken("user-a");
    const tokenB = signToken("user-b");

    expect((await get("/api/ping", tokenA)).status).toBe(200);
    expect((await get("/api/ping", tokenA)).status).toBe(200);
    // User A's bucket (max 2) is now exhausted.
    expect((await get("/api/ping", tokenA)).status).toBe(429);

    // User B, same loopback IP, different valid token — untouched by A's usage.
    expect((await get("/api/ping", tokenB)).status).toBe(200);
    expect((await get("/api/ping", tokenB)).status).toBe(200);
    expect((await get("/api/ping", tokenB)).status).toBe(429);
  });

  test("a forged token (wrong signature) cannot exhaust the impersonated user's real bucket", async () => {
    const victimToken = signToken("victim");
    // Same claimed id, but signed with a secret the attacker doesn't
    // actually have — jwt.verify must reject this.
    const forged = signToken("victim", "attacker-guessed-secret-wrong");

    // Exhaust the real victim's bucket via their genuine token.
    expect((await get("/api/ping", victimToken)).status).toBe(200);
    expect((await get("/api/ping", victimToken)).status).toBe(200);
    expect((await get("/api/ping", victimToken)).status).toBe(429);

    // The forged token fails verification and falls back to IP keying —
    // it must NOT be blocked by the victim's exhausted user-keyed bucket.
    expect((await get("/api/ping", forged)).status).toBe(200);
  });

  test("unauthenticated callers (no token at all) still key by IP, same as before", async () => {
    expect((await get("/api/ping")).status).toBe(200);
    expect((await get("/api/ping")).status).toBe(200);
    expect((await get("/api/ping")).status).toBe(429);
  });

  test("an authenticated caller's exhausted bucket does not block a later unauthenticated request from the same IP", async () => {
    const token = signToken("user-c");
    expect((await get("/api/ping", token)).status).toBe(200);
    expect((await get("/api/ping", token)).status).toBe(200);
    expect((await get("/api/ping", token)).status).toBe(429);

    // No token at all -> IP bucket, separate from user-c's user-keyed bucket.
    expect((await get("/api/ping")).status).toBe(200);
  });
});
