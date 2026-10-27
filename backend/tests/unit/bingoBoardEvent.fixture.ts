import { afterAll, beforeAll, beforeEach, expect, mock, spyOn, test } from "bun:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";

process.env.JWT_SECRET = "board-event-fixture-only";
process.env.ALLOW_DEV_AUTH = "false";

function event(id: string, status = "active") {
  return {
    id, status, name: `Event ${id}`, board_size: 9,
    start_date: "2026-10-01", end_date: "2026-10-31",
    created_at: "2026-10-01", updated_at: "2026-10-01",
    bingo_teams: [
      { id: `${id}-own`, name: "My team" },
      { id: `${id}-other`, name: "Other team" },
    ],
  };
}
function tileRows(id: string) {
  return ["approved", "pending", "other"].map((kind) => ({
    id: `${id}-${kind}`, type: "Drops", task: `${id} ${kind}`,
    points: 5, target_value: 1, metadata: {},
  }));
}
let selected: ReturnType<typeof event> | null;
let latest: ReturnType<typeof event> | null;
let selectionReads = 0;
const tileEventIds: string[] = [];
const pendingFilters: Array<[string, string]> = [];

// Keep the real selector, tile loader, auth middleware, and response builder.
// The DB changes selection immediately after returning the first event.
mock.module("../../src/db/client.js", () => ({
  getDb: () => ({
    from(table: string) {
      const filters = new Map<string, string>();
      let selecting = false;
      const query = {
        select: () => query,
        in: () => { selecting = true; return query; },
        eq: (column: string, value: string) => {
          filters.set(column, value);
          if (table === "bingo_submissions") pendingFilters.push([column, value]);
          return query;
        },
        limit: () => query,
        order: () => {
          if (table !== "bingo_board_tiles") return query;
          const id = filters.get("bingo_id");
          if (!id) throw new Error("Tile read requires an event ID");
          tileEventIds.push(id);
          return Promise.resolve({ data: tileRows(id), error: null });
        },
        maybeSingle: async () => {
          if (table !== "bingos") throw new Error(`Unexpected read: ${table}`);
          if (!selecting) return { data: latest, error: null };
          selectionReads++;
          const data = selected;
          selected = event("B");
          return { data, error: null };
        },
        not: async () => ({ data: [{ tile_id: "A-pending" }], error: null }),
      };
      return query;
    },
  }),
}));

const users = await import("../../src/db/users.js");
spyOn(users, "findUserById").mockImplementation(async (id) => ({
  id, username: id, role: "user", createdAt: "2026-10-01", updatedAt: "2026-10-01",
}));
const players = await import("../../src/db/players.js");
const ownership = spyOn(players, "resolveMyBingoPlayer").mockImplementation(
  async (bingoId, userId) => userId === "member" ? {
    id: "player", bingo_id: bingoId, team_id: `${bingoId}-own`,
    captain_team_id: null, rsn: "Fixture", registered_by: userId,
    registered_at: "2026-10-01",
  } : null
);
const engine = await import("../../src/services/completionEngine.js");
const completion = spyOn(engine, "computeBingoCompletion").mockImplementation(
  async () => ({
    completedTileIdsByTeam: new Map([
      ["A-own", new Set(["A-approved"])],
      ["A-other", new Set(["A-other"])],
    ]),
    progressByTeamAndTile: new Map(), totalPointsByTeam: new Map(),
    unresolvableTiles: [],
  })
);
const { default: bingoRoutes } = await import("../../src/routes/bingo.js");
const { errorHandler } = await import("../../src/middleware/errorHandler.js");
let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use("/api/bingo", bingoRoutes);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP listener");
  url = `http://127.0.0.1:${address.port}/api/bingo/board`;
});
afterAll(() => server.close());
beforeEach(() => {
  selected = event("A");
  latest = null;
  selectionReads = 0;
  tileEventIds.length = 0;
  pendingFilters.length = 0;
  ownership.mockClear();
  completion.mockClear();
});
async function request(userId?: string) {
  const headers: Record<string, string> = {};
  if (userId) headers.cookie = `authToken=${jwt.sign({ id: userId }, process.env.JWT_SECRET!)}`;
  const response = await fetch(url, { headers });
  expect(response.status).toBe(200);
  return response.json();
}
function expectedTiles(member: boolean) {
  return tileRows("A").map((tile) => ({
    id: tile.id, task: tile.task, type: tile.type, points: tile.points,
    targetValue: tile.target_value,
    completedByMyTeam: member && tile.id === "A-approved",
    pendingByMyTeam: member && tile.id === "A-pending",
  }));
}

for (const userId of [undefined, "member", "unrostered"]) {
  test(`event switch preserves metadata, tiles and ownership for ${userId ?? "anonymous"}`, async () => {
    const member = userId === "member";
    expect(await request(userId)).toEqual({
      active: true, bingo: { id: "A", name: "Event A", boardSize: 9 },
      myTeam: member ? { id: "A-own", name: "My team" } : null,
      tiles: expectedTiles(member),
    });
    expect(selected?.id).toBe("B");
    expect(selectionReads).toBe(1);
    expect(tileEventIds).toEqual(["A"]);
    if (userId) expect(ownership).toHaveBeenCalledWith("A", userId);
    else expect(ownership).not.toHaveBeenCalled();
    if (member) {
      expect(completion).toHaveBeenCalledWith("A", tileRows("A").map((tile) => ({
        id: tile.id, task: tile.task, type: tile.type, points: tile.points,
        targetValue: tile.target_value,
      })), ["A-own", "A-other"]);
      expect(pendingFilters).toEqual([
        ["bingo_id", "A"], ["team_id", "A-own"], ["status", "pending"],
      ]);
    } else {
      expect(completion).not.toHaveBeenCalled();
      expect(pendingFilters).toEqual([]);
    }
  });
}

test("no selected or latest event preserves the empty response", async () => {
  selected = null;
  expect(await request()).toEqual({ active: false });
  expect(tileEventIds).toEqual([]);
});
test("a complete latest event preserves ended metadata", async () => {
  selected = null;
  latest = event("ended", "complete");
  expect(await request()).toEqual({ active: false, ended: {
    name: "Event ended", endDate: "2026-10-31",
  } });
  expect(tileEventIds).toEqual([]);
});
test("a selected draft stays hidden when selection changes to active", async () => {
  selected = event("draft", "draft");
  latest = selected;
  expect(await request("member")).toEqual({ active: false });
  expect(tileEventIds).toEqual([]);
  expect(ownership).not.toHaveBeenCalled();
  expect(completion).not.toHaveBeenCalled();
});
