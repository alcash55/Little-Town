/**
 * D1 regression coverage (TEAM-BRIEF.md Sprint 14): the exact prod repro —
 * a lowercase-stored tile.task ("hitpoints", bingo_board_tiles.task is
 * always lowercase per the Team Drafter/boardTilesSchema) against the OSRS
 * hiscores lite API's canonically-cased skill name ("Hitpoints"). Before
 * the fix, GET /my-team-data's skillDeltas/activityDeltas were keyed by the
 * RAW hiscore name (`curr.name`, real-cased), so
 * `player.skillDeltas[tile.task]` (frontend, real-cased lookup against a
 * lowercase key) missed for every KC/XP tile — TeamData showed "no
 * progress yet" for a team that had genuinely completed board tiles.
 *
 * Fix: both this route (producer) and
 * frontend/src/components/Pages/TeamData/helpers.ts's getTileCell
 * (consumer) now key/lookup by normalizeTaskText — this file pins the
 * producer half of that shared contract; the consumer half is pinned in
 * helpers.test.ts.
 *
 * Runs against the real bingos/bingo_players/bingo_player_hiscores/
 * bingo_board_tiles tables on the local Supabase stack, same
 * server-under-test technique as my-team-data.test.ts.
 */
process.env.JWT_SECRET = "my-team-data-delta-keying-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { normalizeTaskText } from "../../src/services/completionEngine.js";
import bingoRoutes from "../../src/routes/bingo.js";
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

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[my-team-data-delta-keying.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[my-team-data-delta-keying.test.ts] skipping: another bingo is already active in the shared local stack",
  );
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
  const username = `DeltaKeyTest${role}${uniqueSuffix()}`;
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

async function insertTestPlayer(bingoId: string, teamId: string, rsn: string, registeredBy: string) {
  const { data, error } = await getDb()
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn, team_id: teamId, registered_by: registeredBy })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert test player "${rsn}": ${error?.message}`);
  return (data as { id: string }).id;
}

async function insertSnapshot(
  playerId: string,
  type: "start" | "current",
  skills: Array<{ id: number; name: string; xp: number }>,
  activities: Array<{ id: number; name: string; kc: number }> = [],
) {
  const { error } = await getDb()
    .from("bingo_player_hiscores")
    .insert({ player_id: playerId, type, skills, activities, taken_at: new Date().toISOString() });
  if (error) throw new Error(`Failed to insert ${type} snapshot: ${error.message}`);
}

let server: http.Server;
let port: number;

function get(path: string, token: string): Promise<{ status: number; body: any }> {
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

describe.skipIf(!suite)("GET /api/bingo/my-team-data — skillDeltas/activityDeltas keying (D1)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let user: TestUser;
  let playerId: string;
  let xpTile: { task: string };
  let kcTile: { task: string };

  test("fixtures: active bingo, lowercase-task XP + KC tiles, one player with real hiscore-cased deltas", async () => {
    bingo = await insertTestBingo(`test-delta-keying-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `Team ${uniqueSuffix()}`);

    // Exactly the prod shape: bingo_board_tiles.task stored lowercase.
    const xpTileRow = await insertTestTile(bingo.id, {
      position: 0,
      type: "Experience",
      task: "hitpoints",
      points: 10,
      targetValue: 20,
    });
    xpTile = { task: xpTileRow.task };
    expect(xpTile.task).toBe("hitpoints");

    const kcTileRow = await insertTestTile(bingo.id, {
      position: 1,
      type: "Kill Count",
      task: "general graardor",
      points: 20,
      targetValue: 5,
    });
    kcTile = { task: kcTileRow.task };

    user = await insertTestUser("user");
    const rsn = `DeltaKeyPlayer${uniqueSuffix()}`;
    playerId = await insertTestPlayer(bingo.id, team.id, rsn, user.id);

    // start: zero progress. current: real hiscore-API canonical casing
    // ("Hitpoints", "General Graardor") — the exact mismatch that broke
    // the old raw-key lookup.
    await insertSnapshot(
      playerId,
      "start",
      [{ id: 1, name: "Hitpoints", xp: 0 }],
      [{ id: 2, name: "General Graardor", kc: 0 }],
    );
    await insertSnapshot(
      playerId,
      "current",
      [{ id: 1, name: "Hitpoints", xp: 500_215 }],
      [{ id: 2, name: "General Graardor", kc: 12 }],
    );
  });

  test("skillDeltas/activityDeltas are keyed by normalizeTaskText(curr.name), matching tile.task exactly", async () => {
    const { status, body } = await get("/api/bingo/my-team-data", signToken(user));
    expect(status).toBe(200);

    const player = body.data.players.find((p: { playerId: string }) => p.playerId === playerId);
    expect(player).toBeDefined();

    // Keying-contract pin: normalizeTaskText("Hitpoints") === "hitpoints"
    // === xpTile.task. If either side's normalizer is ever renamed/changed
    // without updating the other, this assertion is what breaks loudly.
    expect(normalizeTaskText("Hitpoints")).toBe(xpTile.task);
    expect(normalizeTaskText("General Graardor")).toBe(kcTile.task);

    // The actual prod repro: a real-cased raw lookup would be undefined;
    // the normalized-key lookup the frontend now performs must hit.
    expect(player.skillDeltas[xpTile.task]).toBe(500_215);
    expect(player.skillDeltas["Hitpoints"]).toBeUndefined();

    expect(player.activityDeltas[kcTile.task]).toBe(12);
    expect(player.activityDeltas["General Graardor"]).toBeUndefined();
  });

  test("the engine-computed tile completion agrees: the Hitpoints tile (target 20 XP) is marked completed for the team", async () => {
    const { body } = await get("/api/bingo/my-team-data", signToken(user));
    const tile = body.data.tiles.find((t: { task: string }) => t.task === xpTile.task);
    expect(tile).toBeDefined();
    expect(tile.completed).toBe(true);
  });
});
