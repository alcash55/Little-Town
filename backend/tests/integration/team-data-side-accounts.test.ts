/**
 * #54 — the specific regression this issue is about: `GET /team-data` and
 * `GET /my-team-data` used to build their per-player skill/activity delta
 * breakdown from `getAllPlayerSnapshots()` directly (main account only),
 * while the authoritative `teamProgress` figure for the same tile already
 * went through `completionEngine.ts`'s `playerMetricDelta` (side accounts
 * included). A team with at least one side account could see a tile marked
 * complete, or `teamProgress` higher than what its own per-player rows
 * summed to, with nothing on the page explaining the gap.
 *
 * Real Express app + real router + real DB, same technique as
 * bingo-board.test.ts. Skips cleanly if the shared local stack isn't up or
 * another bingo is already active on it.
 */
process.env.JWT_SECRET = "team-data-side-accounts-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import bingoRoutes from "../../src/routes/bingo.js";
import { savePlayerSnapshot, addSideAccount } from "../../src/db/players.js";
import type { HiscoreData } from "../../src/types/index.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  insertTestTeam,
  insertTestTile,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
  type BingoTeamRow,
} from "./helpers.js";

function killCountData(name: string, kc: number): HiscoreData {
  return {
    name,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 0 }],
    activities: [{ id: 1, name: "Vorkath", rank: 500, kc }],
    updatedAt: new Date(),
  };
}

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[team-data-side-accounts.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn("[team-data-side-accounts.test.ts] skipping: another bingo is already active in the shared local stack");
}
const suite = stack.reachable && !preexistingActive;

interface TestUser {
  id: string;
  username: string;
  role: "user" | "admin" | "moderator";
}

const createdUserIds: string[] = [];
const createdBingoIds: string[] = [];

async function insertTestUser(role: TestUser["role"] = "user"): Promise<TestUser> {
  const username = `TeamDataSideTest${role}${uniqueSuffix()}`;
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

async function insertTestPlayer(bingoId: string, teamId: string | null, rsn: string, registeredBy: string) {
  const { data, error } = await getDb()
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn, team_id: teamId, registered_by: registeredBy })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert test player "${rsn}": ${error?.message}`);
  return (data as { id: string }).id;
}

let server: http.Server;
let port: number;

function request(path: string, token: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path, headers: { Authorization: `Bearer ${token}` } }, (res) => {
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
  await Promise.all(
    createdUserIds.map((id) => getDb().from("users").delete().eq("id", id).then(() => undefined, () => undefined)),
  );
});

describe.skipIf(!suite)("GET /team-data, /my-team-data — side accounts reconcile with teamProgress (#54)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let tile: { id: string; task: string };
  let owner: TestUser;

  test("fixtures: one team, one player with a side account, both gaining Vorkath KC on the same tracked tile", async () => {
    bingo = await insertTestBingo(`test-team-data-side-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `SideTeam ${uniqueSuffix()}`);

    const t = await insertTestTile(bingo.id, {
      position: 0,
      task: "Vorkath",
      type: "Kill Count",
      points: 20,
      targetValue: 100,
    });
    tile = { id: t.id, task: t.task };

    owner = await insertTestUser("user");
    const playerId = await insertTestPlayer(bingo.id, team.id, `SidePlayer${uniqueSuffix()}`, owner.id);

    // Main account: +10 Vorkath KC.
    await savePlayerSnapshot(playerId, "start", killCountData("main", 0));
    await savePlayerSnapshot(playerId, "current", killCountData("main", 10));

    // Side account: +5 more Vorkath KC on the SAME real person, tracked
    // toward the same tile — this is the gap #54 is about: the engine's
    // own teamProgress already sums both accounts, the per-player
    // breakdown used to only read the main one.
    const side = await addSideAccount(playerId, `SideAlt${uniqueSuffix()}`, undefined, owner.id);
    await savePlayerSnapshot(playerId, "start", killCountData("side", 0), side.id);
    await savePlayerSnapshot(playerId, "current", killCountData("side", 5), side.id);
  });

  test("/team-data: the sum of per-player activityDeltas for the tile equals 15 (main + side)", async () => {
    const { status, body } = await request("/api/bingo/team-data", signToken(owner));
    expect(status).toBe(200);

    const teamRow = body.data.teams.find((t: any) => t.teamId === team.id);
    expect(teamRow).toBeDefined();

    const normalizedTask = tile.task.toLowerCase();
    const summedDelta = teamRow.players.reduce(
      (sum: number, p: any) => sum + (p.activityDeltas?.[normalizedTask] ?? 0),
      0,
    );
    // Main account +10, side account +5, same real person, same tile —
    // this is exactly the sum services/completionEngine.ts's own
    // teamProgress figure produces for it (proven against /my-team-data
    // below).
    expect(summedDelta).toBe(15);
  });

  test("/my-team-data: teamProgress for the tile equals the sum of the per-player breakdown", async () => {
    const { status, body } = await request("/api/bingo/my-team-data", signToken(owner));
    expect(status).toBe(200);

    const tileEntry = body.data.tiles.find((t: any) => t.task === tile.task);
    expect(tileEntry).toBeDefined();
    expect(tileEntry.teamProgress).toBe(15);

    const normalizedTask = tile.task.toLowerCase();
    const summedDelta = body.data.players.reduce(
      (sum: number, p: any) => sum + (p.activityDeltas?.[normalizedTask] ?? 0),
      0,
    );
    expect(summedDelta).toBe(tileEntry.teamProgress);
  });
});
