/**
 * POST /api/onboarding/rsn — start-snapshot regression coverage for players
 * who claim their RSN into a bingo that is ALREADY 'active' (as opposed to
 * onboarding-rsn.test.ts's fixture bingo, which is deliberately left
 * 'draft' to avoid uq_bingos_one_active fights on the shared local stack).
 *
 * Root cause (bug-report investigation, see todo.md): unlike
 * routes/admin.ts's POST /bingo/players (admin-registers a player, always
 * takes a start snapshot) and POST .../side-accounts (best-effort snapshot
 * when the bingo is already active), this route's registerBingoPlayer()
 * call never took a snapshot at all. A player joining mid-bingo through
 * self-service onboarding had no start snapshot until an admin manually ran
 * POST /bingo/:bingoId/retake-start-snapshots — until then, GET
 * /api/bingo/my-team-data's skillDeltas/activityDeltas read as empty/zero
 * for that player (start ?? current fallback never kicks in; the delta math
 * needs BOTH). Fixed by taking the snapshot immediately, best-effort, same
 * pattern as the side-account case.
 *
 * Same guard as tests/integration/bingo-board.test.ts: only one bingo may be
 * 'active' at a time across the whole shared local stack
 * (uq_bingos_one_active) — skips cleanly if another test/worktree already
 * has one active.
 */
process.env.JWT_SECRET = "onboarding-rsn-active-snapshot-test-secret-do-not-use-elsewhere";
process.env.ONBOARDING_RSN_RATE_LIMIT_MAX = "1000";

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import type { HiscoreData } from "../../src/types/index.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  countHiscoreRows,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[onboarding-rsn-active-snapshot.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[onboarding-rsn-active-snapshot.test.ts] skipping: another bingo is already active in the shared local stack",
  );
}
const suite = stack.reachable && !preexistingActive;

function fakeHiscoreData(name: string): HiscoreData {
  return {
    name,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 12345 }],
    activities: [],
    updatedAt: new Date(),
  };
}

const hiscoresMock = mock(async (rsn: string): Promise<HiscoreData | null> => fakeHiscoreData(rsn));
mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* the mock above so onboarding.js resolves it.
const { default: onboardingRoutes } = await import("../../src/routes/onboarding.js");

interface TestUser {
  id: string;
  username: string;
  role: "user" | "admin" | "moderator";
}

const createdUserIds: string[] = [];
const createdBingoIds: string[] = [];

async function insertTestUser(role: TestUser["role"] = "user"): Promise<TestUser> {
  const username = `OnboardSnapTest${role}${uniqueSuffix()}`;
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

async function getPlayerIdByRsn(bingoId: string, rsn: string): Promise<string> {
  const { data, error } = await getDb()
    .from("bingo_players")
    .select("id")
    .eq("bingo_id", bingoId)
    .eq("rsn", rsn)
    .single();
  if (error || !data) throw new Error(`Failed to look up player "${rsn}": ${error?.message}`);
  return (data as { id: string }).id;
}

let server: http.Server;
let port: number;

function post(path: string, token: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

beforeAll(async () => {
  if (!suite) return;
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", onboardingRoutes);
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

describe.skipIf(!suite)("POST /api/onboarding/rsn — start snapshot on an active bingo", () => {
  let bingo: BingoRow;

  test("fixtures: an ALREADY-ACTIVE bingo (mid-bingo join scenario)", async () => {
    bingo = await insertTestBingo(`test-onboarding-snap-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);
  });

  test("claiming an RSN into an active bingo takes a start AND current snapshot immediately", async () => {
    const rsn = `OnboardSnapActive${uniqueSuffix()}`;
    const user = await insertTestUser("user");

    const { status } = await post("/api/onboarding/rsn", signToken(user), { rsn });
    expect(status).toBe(200);

    const playerId = await getPlayerIdByRsn(bingo.id, rsn);
    expect(await countHiscoreRows(playerId, "start")).toBe(1);
    expect(await countHiscoreRows(playerId, "current")).toBe(1);
  });

  test("re-claiming the same RSN again is a safe no-op (still exactly one start snapshot)", async () => {
    const rsn = `OnboardSnapReclaim${uniqueSuffix()}`;
    const user = await insertTestUser("user");

    const first = await post("/api/onboarding/rsn", signToken(user), { rsn });
    expect(first.status).toBe(200);
    const second = await post("/api/onboarding/rsn", signToken(user), { rsn });
    expect(second.status).toBe(200);

    const playerId = await getPlayerIdByRsn(bingo.id, rsn);
    expect(await countHiscoreRows(playerId, "start")).toBe(1);
  });

  test("an admin-pre-registered player who already has a start snapshot keeps it (upsert-if-absent, no clobber)", async () => {
    const rsn = `OnboardSnapPreExisting${uniqueSuffix()}`;
    const { registerBingoPlayer, savePlayerSnapshot } = await import("../../src/db/players.js");
    const preRegistered = await registerBingoPlayer(bingo.id, rsn);
    await savePlayerSnapshot(preRegistered.id, "start", fakeHiscoreData(rsn));
    expect(await countHiscoreRows(preRegistered.id, "start")).toBe(1);

    const user = await insertTestUser("user");
    const { status } = await post("/api/onboarding/rsn", signToken(user), { rsn });
    expect(status).toBe(200);

    // Still exactly one start snapshot — claiming didn't duplicate or error.
    expect(await countHiscoreRows(preRegistered.id, "start")).toBe(1);
  });
});
