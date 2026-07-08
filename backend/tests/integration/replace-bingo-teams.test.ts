import { describe, test, expect, afterAll } from "bun:test";

import { updateBingo } from "../../src/db/bingos.js";
import { registerBingoPlayer, getBingoPlayer } from "../../src/db/players.js";
import {
  getLocalStackConfig,
  insertTestBingo,
  insertTestTeam,
  getTeamRows,
  deleteTestBingo,
  uniqueSuffix,
  type BingoRow,
  type BingoTeamRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[replace-bingo-teams.test.ts] skipping: ${stack.reason}`);
}

const createdBingoIds: string[] = [];

describe.skipIf(!stack.reachable)("replace_bingo_teams (via updateBingo)", () => {
  let bingo: BingoRow;
  let keepTeam: BingoTeamRow;
  let dropTeam: BingoTeamRow;
  const keepTeamName = `Keep Team ${uniqueSuffix()}`;
  const dropTeamName = `Drop Team ${uniqueSuffix()}`;
  const newTeamName = `New Team ${uniqueSuffix()}`;
  const keptPlayerRsn = `KeptPlayer${uniqueSuffix()}`;
  const droppedPlayerRsn = `DroppedPlayer${uniqueSuffix()}`;

  test("fixtures: bingo with two teams and one player each", async () => {
    bingo = await insertTestBingo(`test-teams-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);

    keepTeam = await insertTestTeam(bingo.id, keepTeamName);
    dropTeam = await insertTestTeam(bingo.id, dropTeamName);

    await registerBingoPlayer(bingo.id, keptPlayerRsn, keepTeam.id);
    await registerBingoPlayer(bingo.id, droppedPlayerRsn, dropTeam.id);

    const teams = await getTeamRows(bingo.id);
    expect(teams).toHaveLength(2);
  });

  test("replacing team names keeps the id for a matching name and drops the rest", async () => {
    await updateBingo(bingo.id, { teams: [keepTeamName, newTeamName] });

    const teams = await getTeamRows(bingo.id);
    const names = teams.map((t) => t.name).sort();
    expect(names).toEqual([keepTeamName, newTeamName].sort());

    const keptRow = teams.find((t) => t.name === keepTeamName);
    expect(keptRow?.id).toBe(keepTeam.id);

    const droppedRow = teams.find((t) => t.name === dropTeamName);
    expect(droppedRow).toBeUndefined();
  });

  test("a player on the kept team keeps their team_id", async () => {
    const player = await getBingoPlayer(bingo.id, keptPlayerRsn);
    expect(player?.team_id).toBe(keepTeam.id);
  });

  test("a player on the removed team is nulled out (ON DELETE SET NULL)", async () => {
    const player = await getBingoPlayer(bingo.id, droppedPlayerRsn);
    expect(player?.team_id).toBeNull();
  });

  test("passing an empty team list removes all teams", async () => {
    await updateBingo(bingo.id, { teams: [] });
    const teams = await getTeamRows(bingo.id);
    expect(teams).toHaveLength(0);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
