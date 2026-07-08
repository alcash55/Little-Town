import { describe, test, expect, afterAll } from "bun:test";

import { registerBingoPlayer } from "../../src/db/players.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  insertTestTeam,
  deleteTestBingo,
  countBingoPlayerRows,
  uniqueSuffix,
  type BingoRow,
  type BingoTeamRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[register-bingo-player.test.ts] skipping: ${stack.reason}`);
}

const createdBingoIds: string[] = [];

describe.skipIf(!stack.reachable)("registerBingoPlayer (re-register is a race-free no-op)", () => {
  let bingo: BingoRow;
  let originalTeam: BingoTeamRow;
  let otherTeam: BingoTeamRow;
  const rsn = `ReRegPlayer${uniqueSuffix()}`;

  test("fixtures: bingo with two teams", async () => {
    bingo = await insertTestBingo(`test-register-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    originalTeam = await insertTestTeam(bingo.id, `Original ${uniqueSuffix()}`);
    otherTeam = await insertTestTeam(bingo.id, `Other ${uniqueSuffix()}`);
  });

  test("first registration creates the row with the given team", async () => {
    const player = await registerBingoPlayer(bingo.id, rsn, originalTeam.id);
    expect(player.rsn).toBe(rsn);
    expect(player.team_id).toBe(originalTeam.id);
    expect(await countBingoPlayerRows(bingo.id, rsn)).toBe(1);
  });

  test("re-registering with a different teamId does not move the player (no-op)", async () => {
    const player = await registerBingoPlayer(bingo.id, rsn, otherTeam.id);
    expect(player.team_id).toBe(originalTeam.id);
    expect(await countBingoPlayerRows(bingo.id, rsn)).toBe(1);
  });

  test("re-registering with no teamId argument also preserves the existing team_id", async () => {
    const player = await registerBingoPlayer(bingo.id, rsn);
    expect(player.team_id).toBe(originalTeam.id);
    expect(await countBingoPlayerRows(bingo.id, rsn)).toBe(1);
  });

  test("registering a brand-new rsn with no team leaves team_id null", async () => {
    const freshRsn = `FreshPlayer${uniqueSuffix()}`;
    const player = await registerBingoPlayer(bingo.id, freshRsn);
    expect(player.team_id).toBeNull();
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
