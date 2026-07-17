/**
 * Review-endpoints-work-after-complete audit (TEAM-BRIEF.md Sprint 15, Track
 * A frozen contract): "Review endpoints (GET /admin/bingo/screenshots
 * pending list, approve, deny, tag, attribution worklist) work for the
 * latest bingo regardless of its status — remove/adjust any active-only
 * filtering; approve keeps requiring playerId (422)."
 *
 * Every scenario below runs against a bingo whose status is 'complete' —
 * proving the fix actually holds, not just that the routes compile. Real
 * Express app + real admin.ts router against the local stack, same
 * technique as tests/integration/approve-requires-player.test.ts.
 */
process.env.JWT_SECRET = "review-after-complete-test-secret-do-not-use-elsewhere";

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
} from "../../src/db/bingoSubmissions.js";
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
  console.warn(`[review-after-complete.test.ts] skipping: ${stack.reason}`);
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
  const username = `ReviewAfterEnd${role}${uniqueSuffix()}`;
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

function getJson(path: string, token: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path, headers: { Authorization: `Bearer ${token}` } }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(body || "{}") }));
      })
      .on("error", reject);
  });
}

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
  const discordMessageId = `review-end-${uniqueSuffix()}`;
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

describe.skipIf(!suite)("Review endpoints keep working after a bingo completes (status='complete')", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let dropsTileId: string;
  let playerId: string;
  let admin: TestUser;

  test("fixtures: a bingo created directly as 'complete' (simulating the lifecycle's auto-flip), team, Drops tile, registered player", async () => {
    bingo = await insertTestBingo(`test-review-end-${uniqueSuffix()}`, {
      status: "complete",
      end_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `Team ${uniqueSuffix()}`);
    const tile = await insertTestTile(bingo.id, { type: "Drops", task: "Review-After-End Drop" });
    dropsTileId = tile.id;
    const player = await registerBingoPlayer(bingo.id, `ReviewAfterEndPlayer${uniqueSuffix()}`, team.id);
    playerId = player.id;
    admin = await insertTestUser("admin");
  });

  test("GET /bingo/screenshots/pending lists a pending submission for the COMPLETE bingo (previously 404'd via getActiveBingo)", async () => {
    await insertAndFetchPendingSubmission(bingo.id);
    const res = await getJson("/api/admin/bingo/screenshots/pending", signToken(admin));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test("GET /bingo/screenshots/unattributed lists an unattributed approved submission for the COMPLETE bingo, with tileTask resolved", async () => {
    const sub = await insertAndFetchPendingSubmission(bingo.id);
    await approveSubmission(sub.id, { tileId: dropsTileId, teamId: team.id }); // no playerId — unattributed

    const res = await getJson("/api/admin/bingo/screenshots/unattributed", signToken(admin));
    expect(res.status).toBe(200);
    const row = res.body.data.find((s: { id: string }) => s.id === sub.id);
    expect(row).toBeTruthy();
    // Proves tile enrichment (getBingoBoardById) still resolves correctly
    // post-completion, not just the submission row itself.
    expect(row.tileTask).toBe("Review-After-End Drop");
    expect(row.teamName).toBe(team.name);
  });

  test("POST .../approve WITHOUT playerId still 422s on a completed bingo (contract unchanged by completion)", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const res = await postJson(`/api/admin/bingo/screenshots/${submission.id}/approve`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/playerId is required/i);
  });

  test("POST .../approve WITH playerId succeeds (200) on a completed bingo", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const res = await postJson(`/api/admin/bingo/screenshots/${submission.id}/approve`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
      playerId,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("approved");
    expect(res.body.data.player_id).toBe(playerId);
  });

  test("POST .../deny succeeds (200) on a completed bingo", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const res = await postJson(`/api/admin/bingo/screenshots/${submission.id}/deny`, signToken(admin), {});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("rejected");
  });

  test("PATCH .../tag succeeds (200) on a completed bingo", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const res = await patchJson(`/api/admin/bingo/screenshots/${submission.id}/tag`, signToken(admin), {
      tileId: dropsTileId,
      teamId: team.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.tile_id).toBe(dropsTileId);
  });

  // -------------------------------------------------------
  // Tech-lead follow-up (Sprint 15, Track A): the overview must be fully
  // functional for a complete bingo, not just its screenshot-review corner
  // — GET /bingo/players, /bingo/board, /bingo/player-stats, and
  // /bingo/team-stats all previously 404'd via getActiveBingo() once this
  // fixture's status flipped to 'complete'. By this point in the file, the
  // "approve WITH playerId" test above has already approved one submission
  // on dropsTileId (10 points, insertTestTile's default) attributed to
  // `playerId` — real data these routes must now actually reflect.
  // -------------------------------------------------------

  test("GET /bingo/players returns the roster for the COMPLETE bingo (previously 404'd via getActiveBingo)", async () => {
    const res = await getJson("/api/admin/bingo/players", signToken(admin));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const row = res.body.data.find((r: { player: { id: string } }) => r.player.id === playerId);
    expect(row).toBeTruthy();
    expect(Array.isArray(row.sideAccounts)).toBe(true);
  });

  test("GET /bingo/board (admin) returns the board tiles for the COMPLETE bingo", async () => {
    const res = await getJson("/api/admin/bingo/board", signToken(admin));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((t: { id: string }) => t.id === dropsTileId)).toBe(true);
  });

  test("GET /bingo/player-stats reflects the real approved-and-attributed completion on the COMPLETE bingo", async () => {
    const res = await getJson("/api/admin/bingo/player-stats", signToken(admin));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const stat = res.body.data.find((s: { rsn: string }) => s.rsn.startsWith("ReviewAfterEndPlayer"));
    expect(stat).toBeTruthy();
    expect(stat.tilesCompleted).toBe(1);
    expect(stat.totalPoints).toBe(10);
  });

  test("GET /bingo/team-stats runs the completion engine fine on a COMPLETE bingo's frozen snapshots and reflects the same completion", async () => {
    const res = await getJson("/api/admin/bingo/team-stats", signToken(admin));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.unresolvableTiles)).toBe(true);
    const teamStat = res.body.data.find((t: { teamId: string }) => t.teamId === team.id);
    expect(teamStat).toBeTruthy();
    expect(teamStat.tilesCompleted).toBe(1);
    expect(teamStat.totalPoints).toBe(10);
  });

  // NOTE: the "no bingo exists at all -> 404" branch shared by all four
  // widened handlers above (`if (!bingo?.id) return res.status(404)...`) is
  // not re-asserted here — this file's shared local stack always has at
  // least this fixture's bingo present for the suite's duration, and
  // emptying the whole bingos table isn't safe on a stack other concurrent
  // integration test files depend on. That exact case (getLatestBingo()
  // resolving null) is proven in isolation in tests/unit/getLatestBingo.test.ts.
});
