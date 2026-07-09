import { describe, test, expect } from "bun:test";

import {
  validateApprovalPlayerId,
  buildDropStatusByRsn,
  type DropSubmissionAttribution,
} from "../../src/db/bingoSubmissions.js";

// -------------------------------------------------------
// validateApprovalPlayerId — contract 2
// (Story 2d: "playerId validation: wrong team -> 400, unknown id -> 400,
// absent -> ok". Pure over a passed-in roster, so no DB is needed here —
// the route handler is exercised for the actual 400 responses via the
// integration test in tests/integration/approve-submission.test.ts.)
// -------------------------------------------------------

describe("validateApprovalPlayerId (contract 2)", () => {
  const roster = [
    { id: "player-a", team_id: "team-1" },
    { id: "player-b", team_id: "team-2" },
    { id: "player-c", team_id: null },
  ];

  test("absent playerId is valid (undefined -> ok)", () => {
    expect(validateApprovalPlayerId(undefined, "team-1", roster)).toBeNull();
  });

  test("playerId on the given team is valid", () => {
    expect(validateApprovalPlayerId("player-a", "team-1", roster)).toBeNull();
  });

  test("playerId on a different team is rejected", () => {
    const error = validateApprovalPlayerId("player-b", "team-1", roster);
    expect(error).toBe("playerId must be a registered player on the given team");
  });

  test("unknown playerId is rejected", () => {
    const error = validateApprovalPlayerId("does-not-exist", "team-1", roster);
    expect(error).toBe("playerId must be a registered player on the given team");
  });

  test("unassigned player (team_id null) is rejected for any teamId", () => {
    const error = validateApprovalPlayerId("player-c", "team-1", roster);
    expect(error).not.toBeNull();
  });

  test("empty roster rejects any playerId", () => {
    const error = validateApprovalPlayerId("player-a", "team-1", []);
    expect(error).not.toBeNull();
  });
});

// -------------------------------------------------------
// buildDropStatusByRsn — contract 5 (/my-team-data attribution)
// -------------------------------------------------------

describe("buildDropStatusByRsn (contract 5 — attribution via player_id, not submitted_by)", () => {
  const playerIdToRsn = new Map([
    ["player-a", "Zezima"],
    ["player-b", "Woox"],
  ]);
  const tileIdToTask = new Map([
    ["tile-1", "Vorkath"],
    ["tile-2", "Zulrah"],
  ]);

  test("attributes an approved submission to the owning player's rsn+tile", () => {
    const subs: DropSubmissionAttribution[] = [
      { tile_id: "tile-1", player_id: "player-a", status: "approved" },
    ];
    const result = buildDropStatusByRsn(subs, playerIdToRsn, tileIdToTask);
    expect(result).toEqual({ Zezima: { Vorkath: "approved" } });
  });

  test("approved wins over pending for the same rsn+tile", () => {
    const subs: DropSubmissionAttribution[] = [
      { tile_id: "tile-1", player_id: "player-a", status: "pending" },
      { tile_id: "tile-1", player_id: "player-a", status: "approved" },
    ];
    const result = buildDropStatusByRsn(subs, playerIdToRsn, tileIdToTask);
    expect(result.Zezima?.Vorkath).toBe("approved");
  });

  test("a later pending does not downgrade an already-approved entry", () => {
    const subs: DropSubmissionAttribution[] = [
      { tile_id: "tile-1", player_id: "player-a", status: "approved" },
      { tile_id: "tile-1", player_id: "player-a", status: "pending" },
    ];
    const result = buildDropStatusByRsn(subs, playerIdToRsn, tileIdToTask);
    expect(result.Zezima?.Vorkath).toBe("approved");
  });

  test("null player_id (unattributed submission) is dropped, not mis-mapped", () => {
    const subs: DropSubmissionAttribution[] = [
      { tile_id: "tile-1", player_id: null, status: "approved" },
    ];
    const result = buildDropStatusByRsn(subs, playerIdToRsn, tileIdToTask);
    expect(result).toEqual({});
  });

  test("a player_id not on the roster map is dropped rather than throwing", () => {
    const subs: DropSubmissionAttribution[] = [
      { tile_id: "tile-1", player_id: "unknown-player", status: "approved" },
    ];
    const result = buildDropStatusByRsn(subs, playerIdToRsn, tileIdToTask);
    expect(result).toEqual({});
  });

  test("a tile_id outside the Drops tile set is dropped rather than throwing", () => {
    const subs: DropSubmissionAttribution[] = [
      { tile_id: "tile-not-drops", player_id: "player-a", status: "approved" },
    ];
    const result = buildDropStatusByRsn(subs, playerIdToRsn, tileIdToTask);
    expect(result).toEqual({});
  });

  test("multiple players and tiles are kept independent", () => {
    const subs: DropSubmissionAttribution[] = [
      { tile_id: "tile-1", player_id: "player-a", status: "approved" },
      { tile_id: "tile-2", player_id: "player-b", status: "pending" },
    ];
    const result = buildDropStatusByRsn(subs, playerIdToRsn, tileIdToTask);
    expect(result).toEqual({
      Zezima: { Vorkath: "approved" },
      Woox: { Zulrah: "pending" },
    });
  });
});
