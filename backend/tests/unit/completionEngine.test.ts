/**
 * Pure-math unit tests for services/completionEngine.ts (TEAM-BRIEF.md
 * Sprint 13, Track A item 5). No DB access — computeCompletion and its
 * helpers are exercised directly over hand-built player/tile fixtures.
 */
import { describe, test, expect } from "bun:test";

import {
  normalizeTaskText,
  resolveTileMetric,
  buildHiscoreVocab,
  playerMetricDelta,
  teamMetricDelta,
  computeCompletion,
  type EngineTile,
  type EnginePlayer,
  type AccountSnapshots,
} from "../../src/services/completionEngine.js";

// -------------------------------------------------------
// Fixtures
// -------------------------------------------------------

function account(
  startXp: number | null,
  currentXp: number | null,
  skillName = "Zulrah",
  kind: "skill" | "activity" = "activity",
): AccountSnapshots {
  const build = (val: number | null) => {
    if (val === null) return null;
    return kind === "skill"
      ? { skills: [{ name: skillName, xp: val }], activities: [] }
      : { skills: [], activities: [{ name: skillName, kc: val }] };
  };
  return { start: build(startXp), current: build(currentXp) };
}

function player(playerId: string, teamId: string | null, accounts: AccountSnapshots[]): EnginePlayer {
  return { playerId, teamId, accounts };
}

const zulrahKcTile: EngineTile = {
  id: "tile-zulrah",
  task: "Zulrah",
  type: "Kill Count",
  points: 20,
  targetValue: 20,
};

const attackXpTile: EngineTile = {
  id: "tile-attack",
  task: "Attack",
  type: "Experience",
  points: 10,
  targetValue: 1_000_000,
};

const dropsTile: EngineTile = {
  id: "tile-drop",
  task: "Some Rare Drop",
  type: "Drops",
  points: 30,
  targetValue: null,
};

// -------------------------------------------------------
// normalizeTaskText
// -------------------------------------------------------

describe("normalizeTaskText", () => {
  test("trims, lowercases, and collapses internal whitespace", () => {
    expect(normalizeTaskText("  General   Graardor  ")).toBe("general graardor");
  });

  test("is idempotent", () => {
    const once = normalizeTaskText("Tombs of Amascut");
    expect(normalizeTaskText(once)).toBe(once);
  });
});

// -------------------------------------------------------
// resolveTileMetric — task -> hiscore metric matching, unmatched behavior
// -------------------------------------------------------

describe("resolveTileMetric", () => {
  const vocab = buildHiscoreVocab([
    player("p1", "team-a", [account(0, 100, "Zulrah", "activity")]),
    player("p2", "team-a", [account(0, 100, "Attack", "skill")]),
  ]);

  test("Kill Count tile resolves to an activity metric when the (normalized) name is in vocab", () => {
    const resolved = resolveTileMetric({ task: "  zulrah  ", type: "Kill Count" }, vocab);
    expect(resolved).toEqual({ kind: "activity", normalizedName: "zulrah" });
  });

  test("Experience tile resolves to a skill metric when the (normalized) name is in vocab", () => {
    const resolved = resolveTileMetric({ task: "ATTACK", type: "Experience" }, vocab);
    expect(resolved).toEqual({ kind: "skill", normalizedName: "attack" });
  });

  test("Kill Count tile with a task not in the activity vocab is unresolvable (null)", () => {
    expect(resolveTileMetric({ task: "Not A Real Boss", type: "Kill Count" }, vocab)).toBeNull();
  });

  test("Experience tile with a task not in the skill vocab is unresolvable (null)", () => {
    expect(resolveTileMetric({ task: "Not A Real Skill", type: "Experience" }, vocab)).toBeNull();
  });

  test("a Kill Count task that only matches a SKILL name (wrong bucket) is unresolvable", () => {
    // "Attack" is a skill, not an activity — Kill Count tiles must only match activities.
    expect(resolveTileMetric({ task: "Attack", type: "Kill Count" }, vocab)).toBeNull();
  });

  test("Drops tiles never resolve, regardless of vocab", () => {
    expect(resolveTileMetric({ task: "Zulrah", type: "Drops" }, vocab)).toBeNull();
  });
});

// -------------------------------------------------------
// Delta math — team summing, missing start snapshot, side accounts
// -------------------------------------------------------

describe("playerMetricDelta / teamMetricDelta", () => {
  const metric = { kind: "activity" as const, normalizedName: "zulrah" };

  test("a single account's delta is current - start", () => {
    const p = player("p1", "team-a", [account(10, 35, "Zulrah")]);
    expect(playerMetricDelta(p, metric)).toBe(25);
  });

  test("missing start snapshot treats delta as 0 (never negative, never throws)", () => {
    const p = player("p1", "team-a", [account(null, 35, "Zulrah")]);
    expect(playerMetricDelta(p, metric)).toBe(0);
  });

  test("missing current snapshot contributes 0", () => {
    const p = player("p1", "team-a", [account(10, null, "Zulrah")]);
    expect(playerMetricDelta(p, metric)).toBe(0);
  });

  test("a player's side-account deltas are summed into their contribution (main + side accounts)", () => {
    const p = player("p1", "team-a", [
      account(10, 35, "Zulrah"), // main: +25
      account(0, 15, "Zulrah"), // side: +15
    ]);
    expect(playerMetricDelta(p, metric)).toBe(40);
  });

  test("team-total semantics: two players with 10 KC each complete a 20 KC tile (summed, not maxed)", () => {
    const players = [
      player("p1", "team-a", [account(0, 10, "Zulrah")]),
      player("p2", "team-a", [account(0, 10, "Zulrah")]),
    ];
    expect(teamMetricDelta(players, "team-a", metric)).toBe(20);
  });

  test("a teammate missing a start snapshot doesn't zero out the whole team's total", () => {
    const players = [
      player("p1", "team-a", [account(0, 10, "Zulrah")]), // +10
      player("p2", "team-a", [account(null, 8, "Zulrah")]), // missing start -> 0
    ];
    expect(teamMetricDelta(players, "team-a", metric)).toBe(10);
  });

  test("players on other teams never contribute to this team's total", () => {
    const players = [
      player("p1", "team-a", [account(0, 10, "Zulrah")]),
      player("p2", "team-b", [account(0, 999, "Zulrah")]),
    ];
    expect(teamMetricDelta(players, "team-a", metric)).toBe(10);
  });

  test("an unassigned player (teamId null) never contributes to any team", () => {
    const players = [player("p1", null, [account(0, 999, "Zulrah")])];
    expect(teamMetricDelta(players, "team-a", metric)).toBe(0);
  });
});

// -------------------------------------------------------
// computeCompletion — end-to-end pure orchestration
// -------------------------------------------------------

describe("computeCompletion", () => {
  test("Kill Count tile completes for a team once the SUMMED delta reaches target_value (target boundary: exact match completes)", () => {
    const players = [
      player("p1", "team-a", [account(0, 10, "Zulrah")]),
      player("p2", "team-a", [account(0, 10, "Zulrah")]),
    ];
    const result = computeCompletion([zulrahKcTile], players, ["team-a"], new Map());
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-zulrah")).toBe(true);
    expect(result.progressByTeamAndTile.get("team-a")!.get("tile-zulrah")).toBe(20);
    expect(result.totalPointsByTeam.get("team-a")).toBe(20);
  });

  test("target boundary: one short of target_value does not complete", () => {
    const players = [player("p1", "team-a", [account(0, 19, "Zulrah")])];
    const result = computeCompletion([zulrahKcTile], players, ["team-a"], new Map());
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-zulrah")).toBe(false);
    expect(result.totalPointsByTeam.get("team-a")).toBe(0);
  });

  test("Experience tile completion works the same way over skill XP", () => {
    const players = [player("p1", "team-a", [account(0, 1_000_000, "Attack", "skill")])];
    const result = computeCompletion([attackXpTile], players, ["team-a"], new Map());
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-attack")).toBe(true);
  });

  test("an unmatched trackable tile lands in unresolvableTiles and never completes for any team", () => {
    const unmatched: EngineTile = {
      id: "tile-unknown",
      task: "Definitely Not A Real Boss",
      type: "Kill Count",
      points: 20,
      targetValue: 1,
    };
    const players = [player("p1", "team-a", [account(0, 999, "Zulrah")])];
    const result = computeCompletion([unmatched], players, ["team-a"], new Map());
    expect(result.unresolvableTiles).toEqual([
      { id: "tile-unknown", task: "Definitely Not A Real Boss", type: "Kill Count" },
    ]);
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-unknown")).toBe(false);
  });

  test("a trackable tile with no target_value never completes but is NOT reported unresolvable (matching succeeded)", () => {
    const noTarget: EngineTile = { ...zulrahKcTile, targetValue: null };
    const players = [player("p1", "team-a", [account(0, 999, "Zulrah")])];
    const result = computeCompletion([noTarget], players, ["team-a"], new Map());
    expect(result.unresolvableTiles).toEqual([]);
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-zulrah")).toBe(false);
  });

  test("Drops tile completes from the approved-submissions map, independent of any hiscore data", () => {
    const approved = new Map([["team-a", new Set(["tile-drop"])]]);
    const result = computeCompletion([dropsTile], [], ["team-a"], approved);
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-drop")).toBe(true);
    expect(result.totalPointsByTeam.get("team-a")).toBe(30);
  });

  test("Drops tile without an approved submission for this team never completes", () => {
    const approved = new Map([["team-b", new Set(["tile-drop"])]]);
    const result = computeCompletion([dropsTile], [], ["team-a"], approved);
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-drop")).toBe(false);
  });

  // -----------------------------------------------------
  // Dedupe: auto-verified + approved submission on the SAME tile = counted
  // once (TEAM-BRIEF.md item 2 — the legacy ToA scenario).
  // -----------------------------------------------------

  test("dedupe: a trackable (Kill Count) tile that is BOTH auto-verified AND has a legacy approved submission on it is counted exactly once", () => {
    const players = [player("p1", "team-a", [account(0, 20, "Zulrah")])]; // meets target_value=20
    // Simulate a legacy approved submission sitting on the now-trackable tile
    // id (this is exactly the two-ToA-submissions-in-prod scenario) — the
    // approvedDropsTileIdsByTeam map is keyed by the SAME tile id, even
    // though the tile is Kill Count, not Drops.
    const legacyApproved = new Map([["team-a", new Set(["tile-zulrah"])]]);
    const result = computeCompletion([zulrahKcTile], players, ["team-a"], legacyApproved);

    expect(result.completedTileIdsByTeam.get("team-a")!.size).toBe(1);
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-zulrah")).toBe(true);
    // Points counted once, not doubled (20 points, not 40).
    expect(result.totalPointsByTeam.get("team-a")).toBe(20);
  });

  test("dedupe: a legacy approved submission on a trackable tile that ISN'T auto-verified yet still doesn't complete it (submissions are never read for KC/XP tiles)", () => {
    const players = [player("p1", "team-a", [account(0, 5, "Zulrah")])]; // short of target_value=20
    const legacyApproved = new Map([["team-a", new Set(["tile-zulrah"])]]);
    const result = computeCompletion([zulrahKcTile], players, ["team-a"], legacyApproved);
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-zulrah")).toBe(false);
    expect(result.totalPointsByTeam.get("team-a")).toBe(0);
  });

  test("mixed board: Kill Count, Experience, and Drops tiles are evaluated independently and totalPoints sums only completed ones", () => {
    const players = [
      player("p1", "team-a", [account(0, 20, "Zulrah")]),
      player("p1-extra", "team-a", [account(0, 500_000, "Attack", "skill")]), // half of the 1M target
    ];
    const approved = new Map([["team-a", new Set(["tile-drop"])]]);
    const result = computeCompletion(
      [zulrahKcTile, attackXpTile, dropsTile],
      players,
      ["team-a"],
      approved,
    );
    const completed = result.completedTileIdsByTeam.get("team-a")!;
    expect(completed.has("tile-zulrah")).toBe(true); // 20 >= 20
    expect(completed.has("tile-attack")).toBe(false); // 500k < 1M
    expect(completed.has("tile-drop")).toBe(true); // approved
    expect(result.totalPointsByTeam.get("team-a")).toBe(zulrahKcTile.points + dropsTile.points);
  });

  test("multiple teams are computed independently in one pass", () => {
    const players = [
      player("p1", "team-a", [account(0, 20, "Zulrah")]),
      player("p2", "team-b", [account(0, 5, "Zulrah")]),
    ];
    const result = computeCompletion([zulrahKcTile], players, ["team-a", "team-b"], new Map());
    expect(result.completedTileIdsByTeam.get("team-a")!.has("tile-zulrah")).toBe(true);
    expect(result.completedTileIdsByTeam.get("team-b")!.has("tile-zulrah")).toBe(false);
  });

  test("empty teamIds returns empty maps without throwing", () => {
    const result = computeCompletion([zulrahKcTile, dropsTile], [], [], new Map());
    expect(result.completedTileIdsByTeam.size).toBe(0);
    expect(result.totalPointsByTeam.size).toBe(0);
  });
});
