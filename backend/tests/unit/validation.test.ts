import { describe, test, expect } from "bun:test";
import type { Request, Response, NextFunction } from "express";

import {
  validateBody,
  bingoDetailsSchema,
  bingoUpdateSchema,
  boardTileSchema,
  boardTilesSchema,
  draftAssignmentsSchema,
  playerRegistrationSchema,
  sideAccountSchema,
  screenshotApprovalSchema,
} from "../../src/lib/validation.js";

// -------------------------------------------------------
// bingoUpdateSchema — status enum
// -------------------------------------------------------

describe("bingoUpdateSchema status enum", () => {
  test.each([["draft"], ["complete"], ["archived"]])(
    "accepts %s",
    (status: string) => {
      const result = bingoUpdateSchema.safeParse({ status });
      expect(result.success).toBe(true);
    },
  );

  test("rejects 'active' — activation must go through POST /bingo/activate", () => {
    const result = bingoUpdateSchema.safeParse({ status: "active" });
    expect(result.success).toBe(false);
  });

  test("rejects 'ended' (not a real status)", () => {
    const result = bingoUpdateSchema.safeParse({ status: "ended" });
    expect(result.success).toBe(false);
  });

  test("all fields are optional — empty object is valid", () => {
    const result = bingoUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// -------------------------------------------------------
// Duplicate team names rejected (bingoDetailsSchema + bingoUpdateSchema)
// -------------------------------------------------------

describe("duplicate team names rejected", () => {
  test("bingoDetailsSchema rejects case-insensitive duplicate team names", () => {
    const result = bingoDetailsSchema.safeParse({
      name: "Test Bingo",
      teams: ["Team A", "team a"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Team names must be unique");
    }
  });

  test("bingoDetailsSchema accepts unique team names", () => {
    const result = bingoDetailsSchema.safeParse({
      name: "Test Bingo",
      teams: ["Team A", "Team B"],
    });
    expect(result.success).toBe(true);
  });

  test("bingoUpdateSchema rejects case-insensitive duplicate team names", () => {
    const result = bingoUpdateSchema.safeParse({ teams: ["Alpha", "alpha"] });
    expect(result.success).toBe(false);
  });

  test("bingoUpdateSchema accepts unique team names", () => {
    const result = bingoUpdateSchema.safeParse({ teams: ["Alpha", "Beta", "Gamma"] });
    expect(result.success).toBe(true);
  });

  test("bingoDetailsSchema requires a non-empty bingo name", () => {
    const result = bingoDetailsSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

// -------------------------------------------------------
// Board tiles
// -------------------------------------------------------

describe("boardTileSchema", () => {
  test("accepts a well-formed tile", () => {
    const result = boardTileSchema.safeParse({
      type: "Kill Count",
      task: "Kill 50 Zulrah",
      points: 10,
      killCount: 50,
    });
    expect(result.success).toBe(true);
  });

  test("rejects an unknown tile type", () => {
    const result = boardTileSchema.safeParse({
      type: "Not A Type",
      task: "Do a thing",
      points: 1,
    });
    expect(result.success).toBe(false);
  });

  test("rejects an empty task", () => {
    const result = boardTileSchema.safeParse({ type: "Drops", task: "", points: 1 });
    expect(result.success).toBe(false);
  });

  test("rejects a task longer than 100 characters", () => {
    const result = boardTileSchema.safeParse({
      type: "Drops",
      task: "x".repeat(101),
      points: 1,
    });
    expect(result.success).toBe(false);
  });

  test("passthrough retains unrecognized metadata fields", () => {
    const result = boardTileSchema.safeParse({
      type: "Experience",
      task: "Get 1m Slayer XP",
      points: 5,
      experience: 1_000_000,
      customBadge: "gold-star",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).customBadge).toBe("gold-star");
    }
  });

  test("boardTilesSchema validates an array of tiles", () => {
    const result = boardTilesSchema.safeParse([
      { type: "Kill Count", task: "Task 1", points: 1 },
      { type: "Drops", task: "Task 2", points: 2 },
    ]);
    expect(result.success).toBe(true);
  });
});

// -------------------------------------------------------
// Draft assignments
// -------------------------------------------------------

describe("draftAssignmentsSchema", () => {
  test("accepts assignments with a null teamId (unassigned)", () => {
    const result = draftAssignmentsSchema.safeParse([{ rsn: "Zezima", teamId: null }]);
    expect(result.success).toBe(true);
  });

  test("accepts assignments with a string teamId", () => {
    const result = draftAssignmentsSchema.safeParse([
      { rsn: "Zezima", teamId: "11111111-1111-1111-1111-111111111111" },
    ]);
    expect(result.success).toBe(true);
  });

  test("rejects an entry missing the teamId key entirely", () => {
    const result = draftAssignmentsSchema.safeParse([{ rsn: "Zezima" }]);
    expect(result.success).toBe(false);
  });

  test("rejects an empty rsn", () => {
    const result = draftAssignmentsSchema.safeParse([{ rsn: "", teamId: null }]);
    expect(result.success).toBe(false);
  });
});

// -------------------------------------------------------
// Player registration / side accounts
// -------------------------------------------------------

describe("playerRegistrationSchema", () => {
  test("requires a non-empty rsn", () => {
    const result = playerRegistrationSchema.safeParse({ rsn: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("RSN is required");
    }
  });

  test("teamId is optional", () => {
    const result = playerRegistrationSchema.safeParse({ rsn: "Zezima" });
    expect(result.success).toBe(true);
  });

  test("accepts rsn plus teamId", () => {
    const result = playerRegistrationSchema.safeParse({ rsn: "Zezima", teamId: "team-1" });
    expect(result.success).toBe(true);
  });
});

describe("sideAccountSchema", () => {
  test("requires a non-empty rsn", () => {
    const result = sideAccountSchema.safeParse({ rsn: "" });
    expect(result.success).toBe(false);
  });

  test("notes is optional", () => {
    const result = sideAccountSchema.safeParse({ rsn: "AltAccount" });
    expect(result.success).toBe(true);
  });
});

describe("screenshotApprovalSchema (contract 2)", () => {
  test("requires a non-empty tileId", () => {
    const result = screenshotApprovalSchema.safeParse({ tileId: "", teamId: "team-1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Tile ID is required");
    }
  });

  test("requires a non-empty teamId", () => {
    const result = screenshotApprovalSchema.safeParse({ tileId: "tile-1", teamId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Team ID is required");
    }
  });

  test("playerId is optional", () => {
    const result = screenshotApprovalSchema.safeParse({ tileId: "tile-1", teamId: "team-1" });
    expect(result.success).toBe(true);
  });

  test("accepts tileId, teamId and playerId together", () => {
    const result = screenshotApprovalSchema.safeParse({
      tileId: "tile-1",
      teamId: "team-1",
      playerId: "player-1",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an empty-string playerId", () => {
    const result = screenshotApprovalSchema.safeParse({
      tileId: "tile-1",
      teamId: "team-1",
      playerId: "",
    });
    expect(result.success).toBe(false);
  });
});

// -------------------------------------------------------
// validateBody middleware
// -------------------------------------------------------

describe("validateBody middleware", () => {
  function mockRes() {
    const state: { statusCode?: number; body?: unknown } = {};
    const res = {
      status(code: number) {
        state.statusCode = code;
        return res;
      },
      json(body: unknown) {
        state.body = body;
        return res;
      },
    } as unknown as Response;
    return { res, state };
  }

  test("calls next() and replaces req.body with parsed data on success", () => {
    const middleware = validateBody(playerRegistrationSchema);
    const req = { body: { rsn: "Zezima" } } as unknown as Request;
    const { res } = mockRes();
    let nextCalled = false;
    const next = (() => {
      nextCalled = true;
    }) as NextFunction;

    middleware(req, res, next);

    expect(nextCalled).toBe(true);
    expect(req.body).toEqual({ rsn: "Zezima" });
  });

  test("responds 400 with the first issue message and does not call next() on failure", () => {
    const middleware = validateBody(playerRegistrationSchema);
    const req = { body: { rsn: "" } } as unknown as Request;
    const { res, state } = mockRes();
    let nextCalled = false;
    const next = (() => {
      nextCalled = true;
    }) as NextFunction;

    middleware(req, res, next);

    expect(nextCalled).toBe(false);
    expect(state.statusCode).toBe(400);
    expect(state.body).toEqual({ success: false, error: "RSN is required" });
  });
});
