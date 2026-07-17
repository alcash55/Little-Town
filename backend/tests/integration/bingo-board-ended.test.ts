/**
 * GET /api/bingo/board's additive `ended` field (TEAM-BRIEF.md Sprint 15,
 * Track A frozen contract): when there's no active bingo but the most
 * recently-created bingo has status='complete', the response is
 * `{ active: false, ended: { name, endDate } }` instead of the bare
 * `{ active: false } `. Anonymous-safe (name+endDate only) by construction.
 *
 * Real Express app + real bingo.ts router against the local stack, same
 * technique as tests/integration/bingo-board.test.ts. Skips (rather than
 * asserting `ended` is ABSENT for "no bingo exists") wherever the exact
 * state of "nothing else in the shared stack" can't be guaranteed — see
 * tests/unit/getLatestBingo.test.ts for that case in isolation.
 */
process.env.JWT_SECRET = "bingo-board-ended-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { errorHandler } from "../../src/middleware/errorHandler.js";
import bingoRoutes from "../../src/routes/bingo.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[bingo-board-ended.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn("[bingo-board-ended.test.ts] skipping: another bingo is already active in the shared local stack");
}
const suite = stack.reachable && !preexistingActive;

let server: http.Server;
let port: number;
const createdBingoIds: string[] = [];

function request(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(body) }));
      })
      .on("error", reject);
  });
}

beforeAll(async () => {
  if (!suite) return;
  const app = express();
  app.use("/api/bingo", bingoRoutes);
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
});

describe.skipIf(!suite)("GET /api/bingo/board — ended field", () => {
  test("the most recent bingo is status='complete' -> active: false, ended: { name, endDate }", async () => {
    const endDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-board-ended-${uniqueSuffix()}`, {
      status: "complete",
      end_date: endDate,
    });
    createdBingoIds.push(bingo.id);

    const { status, body } = await request("/api/bingo/board");
    expect(status).toBe(200);
    expect(body.active).toBe(false);
    expect(body.ended.name).toBe(bingo.name);
    // Postgres round-trips the timestamp as "...+00:00" rather than "...Z" —
    // compare by instant, not exact string, same reasoning as every other
    // end_date round-trip assertion in this suite.
    expect(new Date(body.ended.endDate).getTime()).toBe(new Date(endDate).getTime());
    // Anonymous-safe by construction — no team/player data of any kind.
    expect(Object.keys(body.ended)).toEqual(["name", "endDate"]);
    expect(Object.keys(body)).toEqual(["active", "ended"]);

    await deleteTestBingo(bingo.id);
  });

  test("the most recent bingo is still 'draft' (never activated) -> ended absent", async () => {
    const bingo = await insertTestBingo(`test-board-draft-only-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);

    const { status, body } = await request("/api/bingo/board");
    expect(status).toBe(200);
    expect(body.active).toBe(false);
    expect(body.ended).toBeUndefined();

    await deleteTestBingo(bingo.id);
  });

  test("a newer draft created after a completed bingo supersedes it — ended goes back to absent", async () => {
    const completeBingo = await insertTestBingo(`test-board-superseded-complete-${uniqueSuffix()}`, {
      status: "complete",
      end_date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });
    const newerDraft = await insertTestBingo(`test-board-superseded-draft-${uniqueSuffix()}`);
    createdBingoIds.push(completeBingo.id, newerDraft.id);

    const { body } = await request("/api/bingo/board");
    expect(body.active).toBe(false);
    expect(body.ended).toBeUndefined();

    await deleteTestBingo(completeBingo.id);
    await deleteTestBingo(newerDraft.id);
  });
});
