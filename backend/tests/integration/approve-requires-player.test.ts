/**
 * POST /bingo/screenshots/:id/approve — playerId now REQUIRED (TEAM-BRIEF.md
 * Sprint 13, Track A frozen contract 3: "approving now 422s without
 * playerId"). Also covers the NEW PATCH .../tag route (added this sprint to
 * make GET /api/bingo/board's pendingByMyTeam contract real — see
 * db/bingoSubmissions.ts's tagPendingSubmission doc comment) and the
 * worklist/player-stats Drops-only scoping (item 3): a submission approved
 * on a Kill Count/Experience tile is scoring-irrelevant and must never show
 * up in the attribution worklist or count toward per-player stats.
 *
 * Real Express app + real admin.ts router against the local stack, same
 * technique as tests/integration/attribution-worklist.test.ts.
 */
process.env.JWT_SECRET = "approve-requires-player-test-secret-do-not-use-elsewhere";

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
  getApprovedSubmissionsMissingAttribution,
} from "../../src/db/bingoSubmissions.js";
import { getPlayerStats } from "../../src/db/playerStats.js";
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
  console.warn(`[approve-requires-player.test.ts] skipping: ${stack.reason}`);
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
  const username = `ApproveReqTest${role}${uniqueSuffix()}`;
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

let server: http.Server;
let port: number;

function postJson(path: string, token: string, body: unknown): Promise<{ status: number; body: any }> {
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

function patchJson(path: string, token: string, body: unknown): Promise<{ status: number; body: any }> {
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

async function insertAndFetchPendingSubmission(bingoId: string): Promise<{ id: string }> {
  const discordMessageId = `msg-${uniqueSuffix()}`;
  await insertPendingSubmission({ bingoId, discordMessageId, imagePath: `test/${discordMessageId}.png` });
  const pending = await getPendingSubmissions(bingoId);
  const row = pending.find((s) => s.discord_message_id === discordMessageId);
  if (!row) throw new Error("fixture: inserted submission not found among pending");
  return { id: row.id };
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

describe.skipIf(!suite)("POST /bingo/screenshots/:id/approve — playerId required (contract 3)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let dropsTileId: string;
  let playerId: string;
  let admin: TestUser;

  test("fixtures: bingo, team, Drops tile, registered player", async () => {
    bingo = await insertTestBingo(`test-approve-req-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `Team ${uniqueSuffix()}`);
    const tile = await insertTestTile(bingo.id, { type: "Drops", task: "Approve-Req Drop" });
    dropsTileId = tile.id;
    const player = await registerBingoPlayer(bingo.id, `ApproveReqPlayer${uniqueSuffix()}`, team.id);
    playerId = player.id;
    admin = await insertTestUser("admin");
  });

  test("approving WITHOUT playerId -> 422, not 200/400/500", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const res = await postJson(`/api/admin/bingo/screenshots/${submission.id}/approve`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
      // playerId intentionally omitted
    });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/playerId is required/i);
  });

  test("the 422'd submission is left untouched (still pending, not silently approved without attribution)", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    await postJson(`/api/admin/bingo/screenshots/${submission.id}/approve`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
    });
    const pending = await getPendingSubmissions(bingo.id);
    expect(pending.some((s) => s.id === submission.id)).toBe(true);
  });

  test("approving WITH a valid playerId -> 200, approved, attributed", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const res = await postJson(`/api/admin/bingo/screenshots/${submission.id}/approve`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
      playerId,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("approved");
    expect(res.body.data.player_id).toBe(playerId);
  });

  test("approving with a playerId not on the given team -> 400 (existing roster validation still runs)", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const otherTeam = await insertTestTeam(bingo.id, `OtherTeam ${uniqueSuffix()}`);
    const res = await postJson(`/api/admin/bingo/screenshots/${submission.id}/approve`, signToken(admin), {
      tileId: dropsTileId,
      teamId: otherTeam.id,
      playerId, // registered on `team`, not `otherTeam`
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/registered player on the given team/);
  });
});

describe.skipIf(!suite)("PATCH /bingo/screenshots/:id/tag (NEW, Sprint 13)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let dropsTileId: string;
  let admin: TestUser;

  test("fixtures", async () => {
    bingo = await insertTestBingo(`test-tag-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `TagTeam ${uniqueSuffix()}`);
    const tile = await insertTestTile(bingo.id, { type: "Drops", task: "Tag Drop" });
    dropsTileId = tile.id;
    admin = await insertTestUser("admin");
  });

  test("tags a pending submission with tile+team, status stays pending", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const res = await patchJson(`/api/admin/bingo/screenshots/${submission.id}/tag`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.tile_id).toBe(dropsTileId);
    expect(res.body.data.team_id).toBe(team.id);
  });

  test("tagging an already-approved submission is rejected (409)", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const player = await registerBingoPlayer(bingo.id, `TagApprovePlayer${uniqueSuffix()}`, team.id);
    await postJson(`/api/admin/bingo/screenshots/${submission.id}/approve`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
      playerId: player.id,
    });
    const res = await patchJson(`/api/admin/bingo/screenshots/${submission.id}/tag`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pending/i);
  });

  test("tagging a nonexistent submission -> 404", async () => {
    const res = await patchJson(
      `/api/admin/bingo/screenshots/00000000-0000-0000-0000-00000000dead/tag`,
      signToken(admin),
      { tileId: dropsTileId, teamId: team.id },
    );
    expect(res.status).toBe(404);
  });
});

describe.skipIf(!suite)("Drops-only scoping (contract/item 3): worklist + player-stats ignore non-Drops submissions", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let killCountTileId: string;
  let dropsTileId: string;
  let admin: TestUser;
  let playerId: string;

  test("fixtures: one Kill Count tile, one Drops tile, both with an unattributed approved submission", async () => {
    bingo = await insertTestBingo(`test-drops-only-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `DropsOnlyTeam ${uniqueSuffix()}`);
    const kcTile = await insertTestTile(bingo.id, { position: 0, type: "Kill Count", task: "Legacy ToA", points: 50 });
    const dropTile = await insertTestTile(bingo.id, { position: 1, type: "Drops", task: "Legacy Drop", points: 20 });
    killCountTileId = kcTile.id;
    dropsTileId = dropTile.id;
    admin = await insertTestUser("admin");

    const player = await registerBingoPlayer(bingo.id, `DropsOnlyPlayer${uniqueSuffix()}`, team.id);
    playerId = player.id;

    // Both approved with a playerId (attributed) via the db function
    // directly — simulates legacy data from before Drops-only was enforced
    // at the route level (contract 3 only gates NEW approvals).
    const kcSub = await insertAndFetchPendingSubmission(bingo.id);
    await postJson(`/api/admin/bingo/screenshots/${kcSub.id}/approve`, signToken(admin), {
      tileId: killCountTileId,
      teamId: team.id,
      playerId,
    });

    const dropSub = await insertAndFetchPendingSubmission(bingo.id);
    await postJson(`/api/admin/bingo/screenshots/${dropSub.id}/approve`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
      playerId,
    });
  });

  test("getPlayerStats only counts the Drops tile — the Kill Count submission is scoring-irrelevant", async () => {
    const stats = await getPlayerStats(bingo.id);
    const stat = stats.find((s) => s.rsn.startsWith("DropsOnlyPlayer"))!;
    expect(stat.tilesCompleted).toBe(1);
    expect(stat.totalPoints).toBe(20); // Drops tile's points only, not 50+20
  });

  test("an UNATTRIBUTED approved submission on a Kill Count tile never appears in the attribution worklist", async () => {
    const kcSub2 = await insertAndFetchPendingSubmission(bingo.id);
    await postJson(`/api/admin/bingo/screenshots/${kcSub2.id}/approve`, signToken(admin), {
      tileId: killCountTileId,
      teamId: team.id,
      playerId, // still required per contract 3, even though it's scoring-irrelevant here
    });
    // Attribute-free approval isn't reachable via the route anymore (422
    // without playerId) — exercise the worklist's Drops-only filter via the
    // db layer directly instead, which is what a pre-contract-3 legacy row
    // (bypassing the API) would look like.
    const { error } = await getDb().from("bingo_submissions").update({ player_id: null }).eq("id", kcSub2.id);
    if (error) throw new Error(`fixture: failed to null out player_id: ${error.message}`);

    const worklist = await getApprovedSubmissionsMissingAttribution(bingo.id);
    expect(worklist.some((s) => s.tile_id === killCountTileId)).toBe(false);
  });
});
