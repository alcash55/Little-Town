/**
 * GET /api/bingo/my-team-data — regression coverage for two of the
 * bug-report investigation's root causes:
 *
 *   H3 (dropStatus casing): the route used to build its tile-id lookup from
 *   a LOWERCASED task, so `dropStatus[rsn][tile.task]` (tile.task is the
 *   real-cased task from the board) missed on any task with an uppercase
 *   letter — nearly all of them ("Zulrah", "General Graardor", ...). Fixed
 *   at the source in routes/bingo.ts; this test uses a mixed-case task name
 *   deliberately so a regression (re-introducing the lowercase) fails loudly.
 *
 *   H2 (team resolution): a user whose OWN player row was admin-registered
 *   (registered_by = the admin, not them — the NORMAL Team Drafter flow)
 *   used to get a 404-shaped "no team" response even after claiming their
 *   RSN via onboarding, because the route only ever checked registered_by.
 *   Fixed via resolveMyBingoPlayer() (see its own dedicated test file,
 *   resolve-my-bingo-player.test.ts, for the DB-level matrix); this test
 *   proves the fix end-to-end through the real route.
 *
 * Same technique/guard as tests/integration/bingo-board.test.ts: real
 * Express app + real router against the local stack; skips if another
 * bingo is already active on the shared stack (uq_bingos_one_active).
 */
process.env.JWT_SECRET = "my-team-data-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { upsertRsnClaim } from "../../src/db/rsnClaims.js";
import { canonicalizeRsn, normalizeRsn } from "../../src/lib/rsn.js";
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
  console.warn(`[my-team-data.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn("[my-team-data.test.ts] skipping: another bingo is already active in the shared local stack");
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
  const username = `TeamDataTest${role}${uniqueSuffix()}`;
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

async function insertTestPlayer(bingoId: string, teamId: string | null, rsn: string, registeredBy: string | null) {
  const { data, error } = await getDb()
    .from("bingo_players")
    .insert({ bingo_id: bingoId, rsn, team_id: teamId, registered_by: registeredBy })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert test player "${rsn}": ${error?.message}`);
  return (data as { id: string }).id;
}

async function insertApprovedSubmission(bingoId: string, tileId: string, teamId: string, playerId: string) {
  const { error } = await getDb()
    .from("bingo_submissions")
    .insert({ bingo_id: bingoId, tile_id: tileId, team_id: teamId, player_id: playerId, status: "approved" });
  if (error) throw new Error(`Failed to insert test submission: ${error.message}`);
}

let server: http.Server;
let port: number;

function get(path: string, token: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get(
        { host: "127.0.0.1", port, path, headers: { Authorization: `Bearer ${token}` } },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(body) }));
        },
      )
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

describe.skipIf(!suite)("GET /api/bingo/my-team-data", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let dropsTile: { id: string; task: string; points: number };
  let admin: TestUser;
  let teammatePlayerId: string;

  test("fixtures: active bingo, one team, one mixed-case Drops tile", async () => {
    bingo = await insertTestBingo(`test-team-data-${uniqueSuffix()}`, { status: "active" });
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `Team ${uniqueSuffix()}`);
    // Deliberately mixed-case task — this is exactly what broke under the
    // lowercase-keyed lookup.
    const t = await insertTestTile(bingo.id, {
      position: 0,
      type: "Drops",
      task: `General Graardor ${uniqueSuffix()}`,
      points: 20,
    });
    dropsTile = { id: t.id, task: t.task, points: t.points };

    admin = await insertTestUser("admin");
    teammatePlayerId = await insertTestPlayer(
      bingo.id,
      team.id,
      `TeammatePlayer${uniqueSuffix()}`,
      admin.id, // admin-registered, same as the real Team Drafter flow
    );
    await insertApprovedSubmission(bingo.id, dropsTile.id, team.id, teammatePlayerId);
  });

  // H2: the caller themselves claims their RSN via rsn_claims (as
  // onboarding's POST /api/onboarding/rsn would do), while their pool row
  // was admin-registered — registered_by never points at them.
  test("H2: a user whose player row was admin-registered sees their team once they've claimed their RSN", async () => {
    const me = await insertTestUser("user");
    const myRsn = `MyClaimedPlayer${uniqueSuffix()}`;
    await insertTestPlayer(bingo.id, team.id, myRsn, admin.id); // admin-registered, not me

    const canonical = canonicalizeRsn(myRsn);
    await upsertRsnClaim(me.id, canonical, normalizeRsn(canonical));

    const { status, body } = await get("/api/bingo/my-team-data", signToken(me));
    expect(status).toBe(200);
    expect(body.data.teamId).toBe(team.id);
    // My teammate's progress (registered_by-based, not the caller) is
    // visible too — team resolution unblocks the whole roster, not just me.
    const rsns = body.data.players.map((p: { rsn: string }) => p.rsn);
    expect(rsns).toContain(myRsn);
    expect(rsns).toContain(
      body.data.players.find((p: { playerId: string }) => p.playerId === teammatePlayerId)?.rsn,
    );
  });

  test("without a claim and without an unambiguous registered_by match, a user sees no team (not an error)", async () => {
    const stranger = await insertTestUser("user");
    const { status, body } = await get("/api/bingo/my-team-data", signToken(stranger));
    expect(status).toBe(200);
    expect(body.data.teamId).toBeNull();
    expect(body.data.players).toEqual([]);
  });

  // H3: dropStatus must be keyed by the tile's real-cased task, matching
  // tiles[].task in the same response, not a lowercased variant. Uses its
  // own unambiguously-resolvable viewer (self-registered, single
  // registered_by match) rather than reusing `admin` — by this point in the
  // file `admin` has registered_by matches on multiple players from earlier
  // tests, which resolveMyBingoPlayer correctly treats as ambiguous (H2
  // regression coverage), and would make this test about the wrong thing.
  test("H3: dropStatus is keyed by the tile's real-cased task", async () => {
    const viewer = await insertTestUser("user");
    await insertTestPlayer(bingo.id, team.id, `ViewerPlayer${uniqueSuffix()}`, viewer.id);

    const { status, body } = await get("/api/bingo/my-team-data", signToken(viewer));
    expect(status).toBe(200);

    const tileEntry = body.data.tiles.find((t: { task: string }) => t.task === dropsTile.task);
    expect(tileEntry).toBeDefined();

    const teammateRow = body.data.players.find((p: { playerId: string }) => p.playerId === teammatePlayerId);
    expect(teammateRow).toBeDefined();
    // The exact real-cased key must be present and 'approved' — a
    // regression to the lowercase bug would put this under
    // dropStatus[dropsTile.task.toLowerCase()] instead, leaving this
    // real-cased lookup undefined.
    expect(teammateRow.dropStatus[dropsTile.task]).toBe("approved");
  });
});
