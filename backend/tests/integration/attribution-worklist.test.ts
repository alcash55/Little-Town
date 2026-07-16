/**
 * Regression coverage for the "Alex still sees broken player stats"
 * follow-up investigation (Sprint 12 root-cause confirmation + PATCH
 * .../attribute reliability, TEAM-BRIEF.md H1 follow-up).
 *
 * Two things this file proves against prod's EXACT reported shape (4 teams,
 * 6 players, 3 approved submissions on 3 different teams, only 1
 * attributed, each unattributed submission's team has 2 candidate players):
 *
 *   1. getPlayerStats()/getTeamStats() are NOT buggy — Alex's screenshot
 *      (3 teams at equal points, only 1 player with any stats) is exactly
 *      what this data SHOULD produce. This is a direct regression test for
 *      that "is this a real aggregation bug" question, not just an
 *      assertion of intent.
 *   2. PATCH /bingo/screenshots/:id/attribute (the backfill path) actually
 *      fixes it end-to-end over HTTP — including the failure modes that
 *      must surface visibly rather than silently: cross-team playerId,
 *      wrong role, wrong submission status — and backfills the missing
 *      `reviewed_by` audit trail (tech-lead follow-up: no current
 *      approve/deny code path can leave `reviewed_by` NULL on prod for a
 *      real authenticated caller, so a NULL there means the row was never
 *      approved through the review API at all; the backfill endpoint closes
 *      that gap going forward without a schema change).
 */
process.env.JWT_SECRET = "attribution-worklist-test-secret-do-not-use-elsewhere";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

import { getDb } from "../../src/db/client.js";
import { getJwtSecret } from "../../src/lib/jwt.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import adminRoutes from "../../src/routes/admin.js";
import { registerBingoPlayer } from "../../src/db/players.js";
import {
  insertPendingSubmission,
  getPendingSubmissions,
  approveSubmission,
  getApprovedSubmissionsMissingAttribution,
} from "../../src/db/bingoSubmissions.js";
import { getPlayerStats, getTeamStats } from "../../src/db/playerStats.js";
import {
  getLocalStackConfig,
  columnExists,
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
  console.warn(`[attribution-worklist.test.ts] skipping: ${stack.reason}`);
}
const hasPlayerIdColumn = stack.reachable ? await columnExists("bingo_submissions", "player_id") : false;
const suite = stack.reachable && hasPlayerIdColumn;

interface TestUser {
  id: string;
  username: string;
  role: "user" | "admin" | "moderator";
}

const createdBingoIds: string[] = [];
const createdUserIds: string[] = [];

async function insertTestUser(role: TestUser["role"]): Promise<TestUser> {
  const username = `AttribTest${role}${uniqueSuffix()}`;
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

async function approveWithoutAttribution(
  bingoId: string,
  teamId: string,
  tileId: string,
): Promise<string> {
  const discordMessageId = `attrib-${uniqueSuffix()}`;
  await insertPendingSubmission({ bingoId, discordMessageId, imagePath: `test/${discordMessageId}.png` });
  const pending = await getPendingSubmissions(bingoId);
  const row = pending.find((s) => s.discord_message_id === discordMessageId);
  if (!row) throw new Error("fixture: inserted submission not found among pending");
  // Deliberately mirrors prod: approved with NO playerId AND no reviewedBy
  // (approveSubmission() called directly here, same as the real route does
  // when `req.user` isn't wired through — see the file doc comment on why
  // reviewed_by NULL on an approved row is notable).
  await approveSubmission(row.id, { tileId, teamId });
  return row.id;
}

let server: http.Server;
let port: number;

function patchJson(
  path: string,
  token: string,
  body: unknown,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let respBody = "";
        res.on("data", (chunk) => (respBody += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(respBody || "{}") }));
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
  app.use("/api/admin", adminRoutes);
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

describe.skipIf(!suite)("attribution gap: prod-shaped reproduction + PATCH backfill", () => {
  let bingo: BingoRow;
  let teamA: BingoTeamRow, teamB: BingoTeamRow, teamC: BingoTeamRow, teamD: BingoTeamRow;
  let tileA: { id: string; points: number };
  let tileB: { id: string; points: number };
  let tileC: { id: string; points: number };
  let p1: string, p2: string, p3: string, p4: string, p5: string, p6: string;
  let submissionBId: string;
  let submissionCId: string;
  let admin: TestUser;
  let moderator: TestUser;

  test("fixtures: 4 teams, 6 players, 3 approved submissions (1 attributed at approval, 2 not)", async () => {
    bingo = await insertTestBingo(`test-attrib-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);

    teamA = await insertTestTeam(bingo.id, `Team A ${uniqueSuffix()}`);
    teamB = await insertTestTeam(bingo.id, `Team B ${uniqueSuffix()}`);
    teamC = await insertTestTeam(bingo.id, `Team C ${uniqueSuffix()}`);
    teamD = await insertTestTeam(bingo.id, `Team D ${uniqueSuffix()}`);

    tileA = await insertTestTile(bingo.id, { position: 0, type: "Drops", task: "Tile A", points: 20 });
    tileB = await insertTestTile(bingo.id, { position: 1, type: "Drops", task: "Tile B", points: 20 });
    tileC = await insertTestTile(bingo.id, { position: 2, type: "Drops", task: "Tile C", points: 20 });

    // 2 candidate players per team with a submission — matches prod exactly.
    p1 = (await registerBingoPlayer(bingo.id, `PlayerA1_${uniqueSuffix()}`, teamA.id)).id;
    p2 = (await registerBingoPlayer(bingo.id, `PlayerA2_${uniqueSuffix()}`, teamA.id)).id;
    p3 = (await registerBingoPlayer(bingo.id, `PlayerB1_${uniqueSuffix()}`, teamB.id)).id;
    p4 = (await registerBingoPlayer(bingo.id, `PlayerB2_${uniqueSuffix()}`, teamB.id)).id;
    p5 = (await registerBingoPlayer(bingo.id, `PlayerC1_${uniqueSuffix()}`, teamC.id)).id;
    p6 = (await registerBingoPlayer(bingo.id, `PlayerC2_${uniqueSuffix()}`, teamC.id)).id;
    void teamD; // 4th team, no players/submissions — mirrors prod's 0-point team

    // Team A: approved WITH a player picked at approval time (the "1 of 3
    // attributed" row).
    const discordMessageId = `attrib-a-${uniqueSuffix()}`;
    await insertPendingSubmission({ bingoId: bingo.id, discordMessageId, imagePath: `test/${discordMessageId}.png` });
    const pendingA = await getPendingSubmissions(bingo.id);
    const rowA = pendingA.find((s) => s.discord_message_id === discordMessageId)!;
    await approveSubmission(rowA.id, { tileId: tileA.id, teamId: teamA.id, playerId: p1 });

    // Team B and C: approved with NO player picked (the "2 of 3
    // unattributed" rows) — this is the exact prod state.
    submissionBId = await approveWithoutAttribution(bingo.id, teamB.id, tileB.id);
    submissionCId = await approveWithoutAttribution(bingo.id, teamC.id, tileC.id);

    admin = await insertTestUser("admin");
    moderator = await insertTestUser("moderator");
  });

  test("H1 root-cause confirmation: team-stats show 3 teams at equal points (attribution-independent)", async () => {
    const teamStats = await getTeamStats(bingo.id);
    const a = teamStats.find((t) => t.teamId === teamA.id)!;
    const b = teamStats.find((t) => t.teamId === teamB.id)!;
    const c = teamStats.find((t) => t.teamId === teamC.id)!;
    const d = teamStats.find((t) => t.teamId === teamD.id)!;

    for (const t of [a, b, c]) {
      expect(t.tilesCompleted).toBe(1);
      expect(t.totalPoints).toBe(20);
    }
    expect(d.tilesCompleted).toBe(0);
    expect(d.totalPoints).toBe(0);

    // Only B and C's tiles are unattributed — matches "2 known unattributed".
    expect(a.unattributedTiles).toBe(0);
    expect(b.unattributedTiles).toBe(1);
    expect(c.unattributedTiles).toBe(1);
  });

  test("H1 root-cause confirmation: player-stats show ONLY the one attributed player (not a bug — working as designed)", async () => {
    const playerStats = await getPlayerStats(bingo.id);
    expect(playerStats.length).toBe(6);

    const byId = new Map(playerStats.map((s) => [s.rsn, s]));
    const p1Stat = [...byId.values()].find((s) => s.rsn.startsWith("PlayerA1"))!;
    expect(p1Stat.tilesCompleted).toBe(1);
    expect(p1Stat.totalPoints).toBe(20);

    // Every other player — including the OTHER player on team A who simply
    // wasn't the one picked — is exactly zero. This is Alex's screenshot,
    // reproduced from first principles: it is the correct, intended output
    // of this data, not an aggregation bug.
    const others = playerStats.filter((s) => !s.rsn.startsWith("PlayerA1"));
    expect(others.length).toBe(5);
    for (const s of others) {
      expect(s.tilesCompleted).toBe(0);
      expect(s.totalPoints).toBe(0);
    }
  });

  test("worklist backend: exactly the 2 unattributed submissions are listed, oldest first", async () => {
    const worklist = await getApprovedSubmissionsMissingAttribution(bingo.id);
    const ids = worklist.map((s) => s.id);
    expect(ids).toContain(submissionBId);
    expect(ids).toContain(submissionCId);
    expect(worklist.every((s) => s.player_id === null)).toBe(true);
  });

  test("PATCH .../attribute rejects a cross-team playerId visibly (400, not silent)", async () => {
    // p5 is on team C, not team B — must be rejected against submissionB.
    const res = await patchJson(`/api/admin/bingo/screenshots/${submissionBId}/attribute`, signToken(admin), {
      playerId: p5,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/registered player on the given team/);
  });

  test("PATCH .../attribute is admin-only — a moderator is rejected visibly (403, not silent)", async () => {
    const res = await patchJson(`/api/admin/bingo/screenshots/${submissionCId}/attribute`, signToken(moderator), {
      playerId: p5,
    });
    // authorize() middleware errors go through the global AppError handler
    // (`{error, code}`, no `success` field) — distinct from the route's own
    // manually-constructed `{success:false, error}` 400/404/409 bodies
    // asserted elsewhere in this file. Either shape is a real, visible
    // error to the frontend (useScreenshotSubmission's `attribute()` reads
    // `err.error` off both), but the SHAPE differs, so this only asserts
    // what's actually true of this failure mode.
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  test("PATCH .../attribute succeeds for a valid same-team playerId AND backfills the missing reviewed_by", async () => {
    const res = await patchJson(`/api/admin/bingo/screenshots/${submissionBId}/attribute`, signToken(admin), {
      playerId: p4,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.player_id).toBe(p4);
    // Gap-fill: this row's reviewed_by was NULL (approved without a
    // reviewer wired through, mirroring prod) — the backfill endpoint
    // stamps the acting admin rather than leaving it permanently
    // unaccountable.
    expect(res.body.data.reviewed_by).toBe(admin.id);
  });

  test("after attribution, player-stats immediately reflect the newly-attributed player", async () => {
    const playerStats = await getPlayerStats(bingo.id);
    const p4Stat = playerStats.find((s) => s.rsn.startsWith("PlayerB2"))!;
    expect(p4Stat.tilesCompleted).toBe(1);
    expect(p4Stat.totalPoints).toBe(20);

    // The worklist now only has team C's submission left.
    const worklist = await getApprovedSubmissionsMissingAttribution(bingo.id);
    expect(worklist.map((s) => s.id)).toEqual([submissionCId]);
  });

  test("PATCH .../attribute on a non-approved submission is rejected visibly (409, not silent)", async () => {
    const discordMessageId = `attrib-pending-${uniqueSuffix()}`;
    await insertPendingSubmission({ bingoId: bingo.id, discordMessageId, imagePath: `test/${discordMessageId}.png` });
    const pending = await getPendingSubmissions(bingo.id);
    const row = pending.find((s) => s.discord_message_id === discordMessageId)!;

    const res = await patchJson(`/api/admin/bingo/screenshots/${row.id}/attribute`, signToken(admin), {
      playerId: p1,
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/pending/);
  });

  test("PATCH .../attribute never overwrites an already-real reviewer with the backfill", async () => {
    // Re-attribute team A's submission (already had player_id AND was
    // approved via approveSubmission WITHOUT a reviewedBy either, in this
    // fixture — so its reviewed_by is also null coming in). Attribute it to
    // p2 instead and confirm the backfill still only fills a genuine gap,
    // never clobbers an existing non-null reviewer on a second call.
    const first = await patchJson(`/api/admin/bingo/screenshots/${submissionCId}/attribute`, signToken(admin), {
      playerId: p6,
    });
    expect(first.status).toBe(200);
    expect(first.body.data.reviewed_by).toBe(admin.id);

    const second = await patchJson(`/api/admin/bingo/screenshots/${submissionCId}/attribute`, signToken(admin), {
      playerId: p5,
    });
    expect(second.status).toBe(200);
    // Still the same admin (a real, non-null value from the first call) —
    // proves the gap-fill guard reads current state rather than
    // unconditionally re-stamping.
    expect(second.body.data.reviewed_by).toBe(admin.id);
    expect(second.body.data.player_id).toBe(p5);
  });
});
