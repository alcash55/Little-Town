import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { PlayerSnapshot } from "../../src/db/players.js";

// Keep module replacements in a child process. The router, authentication,
// event selector, board loader and completion math all run their real code.
process.env.JWT_SECRET = "my-team-data-event-consistency-test-only";
process.env.ALLOW_DEV_AUTH = "false";
const callerIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];
let selectorReads = 0;
let noEvent = false;
const boardEventIds: string[] = [];
const rosterEventIds: string[] = [];
const ownerLookups: string[][] = [];
const board = (id: string) => [
  {
    id: `${id}-xp`,
    task: id === "first" ? "attack" : "prayer",
    type: "Experience",
    points: 1,
    target_value: 10,
  },
  {
    id: `${id}-kc`,
    task: id === "first" ? "zulrah" : "vorkath",
    type: "Kill Count",
    points: 1,
    target_value: 10,
  },
];
mock.module("../../src/db/client.js", () => ({
  getDb: () => ({ from: (table: string) => {
    if (!["bingos", "bingo_board_tiles"].includes(table)) throw new Error(`Unexpected table: ${table}`);
    let eventId = "";
    const query = {
      select: () => query,
      in: () => query,
      limit: () => query,
      eq: (column: string, value: string) => {
        expect(column).toBe("bingo_id");
        eventId = value;
        return query;
      },
      order: () => {
        if (table === "bingos") return query;
        boardEventIds.push(eventId);
        return Promise.resolve({ data: board(eventId), error: null });
      },
      maybeSingle: async () => {
        const id = selectorReads++ === 0 ? "first" : "second";
        return { data: noEvent ? null : {
          id, name: `${id} event`, status: "draft",
          start_date: "2026-01-01", end_date: "2026-02-01", board_size: 2,
          bingo_teams: [{ id: "team-0", name: "Own team" }, { id: "team-1", name: "Other team" }],
        }, error: null };
      },
    };
    return query;
  } }),
}));
const snapshot = (playerId: string, type: "start" | "current", gain: number): PlayerSnapshot => ({
  id: `${playerId}-${type}`, player_id: playerId, side_account_id: null, type, taken_at: "2026-01-02",
  skills: ["Attack", "Prayer"].map((name, id) => ({ id, name, xp: gain, level: 1, rank: 1 })),
  activities: ["Zulrah", "Vorkath"].map((name, id) => ({ id, name, kc: gain, rank: 1 })),
});
const roster = callerIds.map((userId, i) => ({
  player: { id: `player-${i}`, bingo_id: "first", team_id: `team-${i}`, captain_team_id: null,
    rsn: `Player ${i}`, registered_by: userId, registered_at: "2026-01-01" },
  start: snapshot(`player-${i}`, "start", 0),
  current: snapshot(`player-${i}`, "current", (i + 1) * 20),
}));
const actualPlayers = await import("../../src/db/players.js");
mock.module("../../src/db/players.js", () => ({
  ...actualPlayers,
  resolveMyBingoPlayer: async (eventId: string, userId: string) => {
    ownerLookups.push([eventId, userId]);
    return roster.find(({ player }) => player.registered_by === userId)?.player ?? null;
  },
  getAllPlayerSnapshots: async (eventId: string) => {
    rosterEventIds.push(eventId);
    expect(eventId).toBe("first");
    return roster;
  },
  getAllSideAccounts: async () => ({ "player-0": [{ id: "side-0" }] }),
  getSideAccountSnapshotsBulk: async () => new Map([
    ["side-0", { start: snapshot("side-0", "start", 0), current: snapshot("side-0", "current", 5) }],
  ]),
}));
mock.module("../../src/db/users.js", () => ({
  findUserById: async (id: string) => ({ id, username: id, role: id === "admin" ? "admin" : "user",
    createdAt: "2026-01-01", updatedAt: "2026-01-01" }),
}));
const { default: routes } = await import("../../src/routes/bingo.js");
const { errorHandler } = await import("../../src/middleware/errorHandler.js");
let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use("/api/bingo", routes);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP listener");
  url = `http://127.0.0.1:${address.port}/api/bingo/my-team-data`;
});
afterAll(() => server.close());
beforeEach(() => {
  selectorReads = 0;
  noEvent = false;
  boardEventIds.length = 0;
  rosterEventIds.length = 0;
  ownerLookups.length = 0;
});
function request(userId?: string, impersonateId?: string) {
  const headers: Record<string, string> = {};
  if (userId) headers.cookie = `authToken=${jwt.sign({ id: userId }, process.env.JWT_SECRET!)}`;
  if (impersonateId) headers["X-Impersonate-User-Id"] = impersonateId;
  return fetch(url, { headers });
}
for (const [i, callerId] of callerIds.entries()) {
  test(`event switches during caller ${i}'s request without mixing tiles, deltas or teams`, async () => {
    const response = await request(callerId);
    expect(response.status).toBe(200);
    const { success, data } = await response.json();
    expect(success).toBe(true);
    expect(data.bingoName).toBe("first event");
    expect(data.players.map((player: { playerId: string }) => player.playerId)).toEqual([`player-${i}`]);
    const gain = i === 0 ? 25 : 40;
    expect(data.players[0].skillDeltas).toEqual({ attack: gain });
    expect(data.players[0].activityDeltas).toEqual({ zulrah: gain });
    expect(data.tiles.map((tile: { task: string }) => tile.task)).toEqual(["attack", "zulrah"]);
    expect(data.tiles.map((tile: { teamProgress: number }) => tile.teamProgress)).toEqual([gain, gain]);
    expect(data.tiles.every((tile: { completed: boolean }) => tile.completed)).toBe(true);
    expect(data.teamId).toBe(`team-${i}`);
    expect(selectorReads).toBe(1);
    expect(boardEventIds).toEqual(["first", "first"]);
    expect(rosterEventIds).toEqual(["first", "first"]);
    expect(ownerLookups).toEqual([["first", callerId]]);
  });
}
test("impersonation resolves the effective caller's own team", async () => {
  const response = await request("admin", callerIds[1]);
  expect(response.status).toBe(200);
  const { data } = await response.json();
  expect(data.teamId).toBe("team-1");
  expect(data.players.map((player: { playerId: string }) => player.playerId)).toEqual(["player-1"]);
  expect(ownerLookups).toEqual([["first", callerIds[1]]]);
});
test("no event keeps the 404 response without loading players or tiles", async () => {
  noEvent = true;
  const response = await request(callerIds[0]);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ success: false, error: "No active bingo found" });
  expect(boardEventIds).toEqual([]);
  expect(rosterEventIds).toEqual([]);
  expect(ownerLookups).toEqual([]);
});
test("anonymous requests still require authentication", async () => {
  expect((await request()).status).toBe(401);
  expect(selectorReads).toBe(0);
});
