/**
 * Per-IP rate limit on the public GET /api/hiscores/:player proxy
 * (TEAM-BRIEF.md Sprint 5, Track A item 3). Spins up a real (ephemeral,
 * loopback-only) HTTP server with just the hiscores router mounted so the
 * express-rate-limit middleware actually runs — a DB/service-layer test
 * wouldn't exercise it at all, since it's HTTP middleware, not app logic.
 * services/hiscores.ts is mocked so no real OSRS network calls happen.
 *
 * Uses node:http directly for the test client rather than global fetch:
 * other test files in this suite (e.g. imageLinks.test.ts) permanently
 * overwrite globalThis.fetch inside a test and never restore it, and bun
 * runs all test files in one process — a fetch() call here could otherwise
 * be intercepted by a stub left behind by a file that happened to run
 * earlier.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Small limit so the test doesn't need 30+ requests to observe a 429.
process.env.HISCORES_RATE_LIMIT_MAX = "3";

const hiscoresMock = mock(async (rsn: string) => ({
  name: rsn,
  skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 0 }],
  activities: [],
  updatedAt: new Date(),
}));

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* both the env var and the hiscores mock above
// are in place — the limiter reads HISCORES_RATE_LIMIT_MAX once at module
// load time.
const { default: hiscoresRouter } = await import("../../src/routes/hiscores.js");

let server: http.Server;
let port: number;

function getPlayer(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on("error", reject);
  });
}

beforeAll(async () => {
  const app = express();
  app.use("/api/hiscores", hiscoresRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server?.close();
});

describe("GET /api/hiscores/:player rate limit", () => {
  test("the first HISCORES_RATE_LIMIT_MAX requests from one IP succeed", async () => {
    for (let i = 0; i < 3; i++) {
      const { status } = await getPlayer(`/api/hiscores/RateLimitPlayer${i}`);
      expect(status).toBe(200);
    }
    expect(hiscoresMock).toHaveBeenCalledTimes(3);
  });

  test("the next request from the same IP is rejected with 429 and does not reach the handler", async () => {
    hiscoresMock.mockClear();
    const { status, body } = await getPlayer("/api/hiscores/OneTooMany");
    expect(status).toBe(429);
    const parsed = JSON.parse(body);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/too many/i);
    expect(hiscoresMock).not.toHaveBeenCalled();
  });

  test("repeated 429s don't reset the window early (still limited)", async () => {
    const { status } = await getPlayer("/api/hiscores/StillLimited");
    expect(status).toBe(429);
  });
});
