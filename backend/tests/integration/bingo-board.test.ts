/**
 * GET /api/bingo/board (TEAM-BRIEF.md Sprint 7, Track A item 1 — frozen
 * contract; made optionally-authenticated in Sprint 9, Track A). Spins up a
 * real Express app with the actual `optionalAuth`/`protect` middleware and
 * the real bingo.ts router (same technique as
 * tests/integration/impersonation.test.ts / adminRouteMounting.test.ts) so
 * JWT auth, impersonation, and the route handler's DB access all run
 * end-to-end against the local stack's real tables.
 *
 * Only one bingo may have status='active' at a time across the whole shared
 * local stack (uq_bingos_one_active) — skips cleanly if another test/worktree
 * already has one active, same guard as side-account-snapshots.test.ts.
 */
process.env.JWT_SECRET = "bingo-board-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import bingoRoutes from "../../src/routes/bingo.js";
import { savePlayerSnapshot } from "../../src/db/players.js";
import { insertPendingSubmission, getPendingSubmissions, tagPendingSubmission } from "../../src/db/bingoSubmissions.js";
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

function buildHiscoreData(kc: number): HiscoreData {
  return {
    name: "test",
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 0 }],
    activities: [{ id: 1, name: "Vorkath", rank: 500, kc }],
    updatedAt: new Date(),
  };
}

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[bingo-board.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn("[bingo-board.test.ts] skipping: another bingo is already active in the shared local stack");
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
  const username = `BoardTest${role}${uniqueSuffix()}`;
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

async function insertApprovedSubmission(bingoId: string, tileId: string, teamId: string) {
  const { error } = await getDb()
    .from("bingo_submissions")
    .insert({ bingo_id: bingoId, tile_id: tileId, team_id: teamId, status: "approved" });
  if (error) throw new Error(`Failed to insert test submission: ${error.message}`);
}

let server: http.Server;
let port: number;

// `token` omitted (or undefined) sends no Authorization header at all —
// the real "anonymous browser" case, distinct from a garbage/expired
// bearer token, which optionalAuth must also degrade to anonymous rather
// than reject.
function request(
  path: string,
  token?: string,
  impersonateId?: string,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (token !== undefined) headers.Authorization = `Bearer ${token}`;
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

describe.skipIf(!suite)("GET /api/bingo/board", () => {
  let plainUser: TestUser;

  test("no active bingo -> 200 { active: false } (bare object, no other fields)", async () => {
    plainUser = await insertTestUser("user");
    const { status, body } = await request("/api/bingo/board", signToken(plainUser));
    expect(status).toBe(200);
    expect(body).toEqual({ active: false });
  });

  test("no active bingo, anonymous caller -> 200 { active: false }, never 401", async () => {
    const { status, body } = await request("/api/bingo/board");
    expect(status).toBe(200);
    expect(body).toEqual({ active: false });
  });

  describe("with an active bingo", () => {
    let bingo: BingoRow;
    let teamA: BingoTeamRow;
    let teamB: BingoTeamRow;
    let tile1: { id: string; task: string; type: string; points: number; targetValue: number | null };
    let tile2: { id: string; task: string; type: string; points: number; targetValue: number | null };
    let tile3: { id: string; task: string; type: string; points: number; targetValue: number | null };
    let userOnTeamA: TestUser;
    let userOnTeamB: TestUser;
    let userWithNoTeam: TestUser;
    let userNotRegistered: TestUser;
    let adminUser: TestUser;

    // TEAM-BRIEF.md Sprint 13, Track A — tile1 is now Drops (screenshots
    // only exist for Drops tiles going forward, product decision 2); tile3
    // is a Kill Count tile that's genuinely auto-verified from real
    // snapshot deltas, proving completedByMyTeam is now engine-driven
    // rather than a raw approved-submission lookup.
    test("fixtures: active bingo, two teams, a Drops tile with an approved submission, an auto-verified Kill Count tile", async () => {
      bingo = await insertTestBingo(`test-board-${uniqueSuffix()}`, { status: "active" });
      createdBingoIds.push(bingo.id);
      teamA = await insertTestTeam(bingo.id, `TeamA ${uniqueSuffix()}`);
      teamB = await insertTestTeam(bingo.id, `TeamB ${uniqueSuffix()}`);

      const t1 = await insertTestTile(bingo.id, {
        position: 0,
        task: `Rare Drop ${uniqueSuffix()}`,
        type: "Drops",
        points: 25,
      });
      const t2 = await insertTestTile(bingo.id, { position: 1, task: "Zulrah", type: "Kill Count", points: 15 });
      const t3 = await insertTestTile(bingo.id, {
        position: 2,
        task: "Vorkath",
        type: "Kill Count",
        points: 30,
        targetValue: 10,
      });
      tile1 = { id: t1.id, task: t1.task, type: t1.type, points: t1.points, targetValue: t1.target_value };
      tile2 = { id: t2.id, task: t2.task, type: t2.type, points: t2.points, targetValue: t2.target_value };
      tile3 = { id: t3.id, task: t3.task, type: t3.type, points: t3.points, targetValue: t3.target_value };

      userOnTeamA = await insertTestUser("user");
      userOnTeamB = await insertTestUser("user");
      userWithNoTeam = await insertTestUser("user");
      userNotRegistered = await insertTestUser("user");
      adminUser = await insertTestUser("admin");

      const playerAId = await insertTestPlayer(bingo.id, teamA.id, `BoardPlayerA${uniqueSuffix()}`, userOnTeamA.id);
      await insertTestPlayer(bingo.id, teamB.id, `BoardPlayerB${uniqueSuffix()}`, userOnTeamB.id);
      await insertTestPlayer(bingo.id, null, `BoardPlayerNoTeam${uniqueSuffix()}`, userWithNoTeam.id);

      // Only team A has an approved Drops submission, only for tile1.
      await insertApprovedSubmission(bingo.id, tile1.id, teamA.id);

      // Team A's player genuinely gained 10 Vorkath KC (tile3's target) —
      // the engine should auto-verify tile3 for team A from this alone, no
      // submission involved.
      await savePlayerSnapshot(playerAId, "start", buildHiscoreData(0));
      await savePlayerSnapshot(playerAId, "current", buildHiscoreData(10));
    });

    test("active bingo -> full contract shape, tiles in stable board order", async () => {
      const { status, body } = await request("/api/bingo/board", signToken(userOnTeamA));
      expect(status).toBe(200);
      expect(body.active).toBe(true);
      expect(body.bingo).toEqual({ id: bingo.id, name: bingo.name, boardSize: bingo.board_size });
      expect(body.tiles.map((t: { id: string }) => t.id)).toEqual([tile1.id, tile2.id, tile3.id]);
    });

    // TEAM-BRIEF.md Sprint 8, Track A item 4: type/points/targetValue are an
    // ADDITIVE extension to the frozen Sprint 7 contract above.
    test("tiles additionally expose type, points, and targetValue (Sprint 8, Track A item 4)", async () => {
      const { body } = await request("/api/bingo/board", signToken(userOnTeamA));
      const byId = Object.fromEntries(
        body.tiles.map((t: { id: string }) => [t.id, t]),
      ) as Record<string, { type: string; points: number; targetValue: number | null }>;

      expect(byId[tile1.id]).toMatchObject({ type: "Drops", points: 25, targetValue: null });
      // Tiles that never set a target_value expose null, not undefined/omitted.
      expect(byId[tile2.id]).toMatchObject({ type: "Kill Count", points: 15, targetValue: null });
      expect(byId[tile3.id]).toMatchObject({ type: "Kill Count", points: 30, targetValue: 10 });
    });

    // TEAM-BRIEF.md Sprint 13, Track A contract 1: completedByMyTeam
    // broadens to auto-verified (Kill Count/Experience) OR approved Drops
    // submission — tile1 (Drops, approved) and tile3 (Kill Count,
    // auto-verified from real snapshot deltas) are BOTH complete for team A;
    // tile2 (Kill Count, no snapshot data at all -> unmatched/no delta)
    // stays incomplete.
    test("a user on team A sees myTeam=A, tile1 (approved drop) + tile3 (auto-verified KC) completed, tile2 not", async () => {
      const { body } = await request("/api/bingo/board", signToken(userOnTeamA));
      expect(body.myTeam).toEqual({ id: teamA.id, name: teamA.name });
      const byId = Object.fromEntries(body.tiles.map((t: any) => [t.id, t.completedByMyTeam]));
      expect(byId[tile1.id]).toBe(true);
      expect(byId[tile2.id]).toBe(false);
      expect(byId[tile3.id]).toBe(true);
    });

    test("a user on team B sees myTeam=B and NO tiles completed (team A's completion never leaks)", async () => {
      const { body } = await request("/api/bingo/board", signToken(userOnTeamB));
      expect(body.myTeam).toEqual({ id: teamB.id, name: teamB.name });
      expect(body.tiles.every((t: any) => t.completedByMyTeam === false)).toBe(true);
    });

    test("a registered player with no team -> myTeam: null, nothing completed", async () => {
      const { body } = await request("/api/bingo/board", signToken(userWithNoTeam));
      expect(body.myTeam).toBeNull();
      expect(body.tiles.every((t: any) => t.completedByMyTeam === false)).toBe(true);
    });

    test("a caller with no registered player at all -> myTeam: null, board still visible", async () => {
      const { status, body } = await request("/api/bingo/board", signToken(userNotRegistered));
      expect(status).toBe(200);
      expect(body.active).toBe(true);
      expect(body.myTeam).toBeNull();
      expect(body.tiles).toHaveLength(3);
      expect(body.tiles.every((t: any) => t.completedByMyTeam === false)).toBe(true);
    });

    // TEAM-BRIEF.md Sprint 9, Track A frozen contract change: /board is now
    // optionally authenticated. Anonymous callers get the full board (same
    // layout/tasks/points any authenticated caller sees), myTeam: null, and
    // every tile completedByMyTeam: false — never a 401, and never another
    // team's completion data.
    test("anonymous caller (no Authorization header) -> 200, full board, myTeam: null, nothing completed", async () => {
      const { status, body } = await request("/api/bingo/board");
      expect(status).toBe(200);
      expect(body.active).toBe(true);
      expect(body.bingo).toEqual({ id: bingo.id, name: bingo.name, boardSize: bingo.board_size });
      expect(body.myTeam).toBeNull();
      expect(body.tiles.map((t: { id: string }) => t.id)).toEqual([tile1.id, tile2.id, tile3.id]);
      // Team A's approved submission/auto-verified tile must never leak to
      // an anonymous caller.
      expect(body.tiles.every((t: any) => t.completedByMyTeam === false)).toBe(true);
    });

    // TEAM-BRIEF.md Sprint 13, Track A contract 1 (NEW): pendingByMyTeam.
    test("pendingByMyTeam: a pending submission tagged with tile2+teamA renders true for team A, false for team B and anonymous", async () => {
      const discordMessageId = `board-pending-${uniqueSuffix()}`;
      await insertPendingSubmission({ bingoId: bingo.id, discordMessageId, imagePath: `test/${discordMessageId}.png` });
      const pending = await getPendingSubmissions(bingo.id);
      const row = pending.find((s) => s.discord_message_id === discordMessageId)!;
      await tagPendingSubmission(row.id, { tileId: tile2.id, teamId: teamA.id });

      const teamAView = await request("/api/bingo/board", signToken(userOnTeamA));
      const byIdA = Object.fromEntries(teamAView.body.tiles.map((t: any) => [t.id, t.pendingByMyTeam]));
      expect(byIdA[tile2.id]).toBe(true);
      // Never true for a tile with no pending submission for this team.
      expect(byIdA[tile1.id]).toBe(false);

      const teamBView = await request("/api/bingo/board", signToken(userOnTeamB));
      expect(teamBView.body.tiles.every((t: any) => t.pendingByMyTeam === false)).toBe(true);

      const anon = await request("/api/bingo/board");
      expect(anon.body.tiles.every((t: any) => t.pendingByMyTeam === false)).toBe(true);
    });

    test("malformed/garbage token -> degrades to anonymous (200), not 401/500", async () => {
      const { status, body } = await request("/api/bingo/board", "not-a-real-token");
      expect(status).toBe(200);
      expect(body.active).toBe(true);
      expect(body.myTeam).toBeNull();
      expect(body.tiles.every((t: any) => t.completedByMyTeam === false)).toBe(true);
    });

    test("expired token -> degrades to anonymous (200), not 401/500", async () => {
      const expired = jwt.sign(
        { id: userOnTeamA.id, username: userOnTeamA.username, role: userOnTeamA.role },
        getJwtSecret(),
        { expiresIn: -10 },
      );
      const { status, body } = await request("/api/bingo/board", expired);
      expect(status).toBe(200);
      expect(body.active).toBe(true);
      // Must NOT resolve to userOnTeamA's team just because the token's
      // payload was well-formed before it expired.
      expect(body.myTeam).toBeNull();
      expect(body.tiles.every((t: any) => t.completedByMyTeam === false)).toBe(true);
    });

    test("token for a since-deleted user -> degrades to anonymous (200), not 401/500", async () => {
      const ghost = { id: "00000000-0000-0000-0000-00000000dead", username: "ghost", role: "user" as const };
      const { status, body } = await request("/api/bingo/board", signToken(ghost));
      expect(status).toBe(200);
      expect(body.active).toBe(true);
      expect(body.myTeam).toBeNull();
      expect(body.tiles.every((t: any) => t.completedByMyTeam === false)).toBe(true);
    });

    // Impersonation (TEAM-BRIEF.md Sprint 6, Track A item 2) must keep
    // working for authenticated callers on this route — optionalAuth only
    // changes what happens when there's NO usable token.
    test("admin impersonating a user on team B sees myTeam=B (impersonation still works)", async () => {
      const { status, body } = await request("/api/bingo/board", signToken(adminUser), userOnTeamB.id);
      expect(status).toBe(200);
      expect(body.myTeam).toEqual({ id: teamB.id, name: teamB.name });
    });

    // A non-admin sending the impersonation header is silently ignored by
    // applyImpersonation — the request proceeds as their own (team A).
    test("non-admin sending the impersonation header is ignored, sees their own team", async () => {
      const { status, body } = await request("/api/bingo/board", signToken(userOnTeamA), userOnTeamB.id);
      expect(status).toBe(200);
      expect(body.myTeam).toEqual({ id: teamA.id, name: teamA.name });
    });
  });
});
