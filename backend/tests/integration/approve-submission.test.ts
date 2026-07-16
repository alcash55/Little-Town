import { describe, test, expect, afterAll } from "bun:test";

import { registerBingoPlayer } from "../../src/db/players.js";
import {
  approveSubmission,
  attributeApprovedSubmission,
  getApprovedSubmissionsMissingAttribution,
  getPendingSubmissions,
  insertPendingSubmission,
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
  console.warn(`[approve-submission.test.ts] skipping: ${stack.reason}`);
}
const hasPlayerIdColumn = stack.reachable ? await columnExists("bingo_submissions", "player_id") : false;
if (stack.reachable && !hasPlayerIdColumn) {
  console.warn(
    "[approve-submission.test.ts] skipping: bingo_submissions.player_id column not present " +
      "(contract 1 migration not applied yet — see TEAM-BRIEF.md NOTE)",
  );
}

const suite = stack.reachable && hasPlayerIdColumn;
const createdBingoIds: string[] = [];

async function insertAndFetchPendingSubmission(bingoId: string): Promise<{ id: string }> {
  const discordMessageId = `msg-${uniqueSuffix()}`;
  await insertPendingSubmission({
    bingoId,
    discordMessageId,
    imagePath: `test/${discordMessageId}.png`,
  });
  const pending = await getPendingSubmissions(bingoId);
  const row = pending.find((s) => s.discord_message_id === discordMessageId);
  if (!row) throw new Error("fixture: inserted submission not found among pending");
  return { id: row.id };
}

describe.skipIf(!suite)("approveSubmission persists player_id (contract 2)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let playerId: string;
  let tileId: string;

  test("fixtures: bingo, team, tile, registered player", async () => {
    bingo = await insertTestBingo(`test-approve-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `Team ${uniqueSuffix()}`);
    const tile = await insertTestTile(bingo.id, { type: "Drops", task: "Test Drop" });
    tileId = tile.id;
    const player = await registerBingoPlayer(bingo.id, `ApprovePlayer${uniqueSuffix()}`, team.id);
    playerId = player.id;
  });

  test("approving with a playerId persists it on the submission row", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const updated = await approveSubmission(submission.id, {
      tileId,
      teamId: team.id,
      playerId,
    });
    expect(updated.status).toBe("approved");
    expect(updated.player_id).toBe(playerId);
  });

  test("approving without a playerId leaves player_id null", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    const updated = await approveSubmission(submission.id, {
      tileId,
      teamId: team.id,
      // playerId intentionally omitted
    });
    expect(updated.status).toBe("approved");
    expect(updated.player_id).toBeNull();
  });
});

// -------------------------------------------------------
// attributeApprovedSubmission / getApprovedSubmissionsMissingAttribution —
// the backfill path for H1 (bug-report investigation): an admin filling in
// player_id AFTER the fact on a submission that's already approved.
// -------------------------------------------------------

describe.skipIf(!suite)("attribution backfill (H1)", () => {
  let bingo: BingoRow;
  let team: BingoTeamRow;
  let playerId: string;
  let tileId: string;

  test("fixtures: bingo, team, tile, registered player", async () => {
    bingo = await insertTestBingo(`test-attribute-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    team = await insertTestTeam(bingo.id, `Team ${uniqueSuffix()}`);
    const tile = await insertTestTile(bingo.id, { type: "Drops", task: "Test Attribute Drop" });
    tileId = tile.id;
    const player = await registerBingoPlayer(bingo.id, `AttributePlayer${uniqueSuffix()}`, team.id);
    playerId = player.id;
  });

  test("an approved-without-attribution submission shows up in the missing-attribution worklist", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    await approveSubmission(submission.id, { tileId, teamId: team.id });

    const missing = await getApprovedSubmissionsMissingAttribution(bingo.id);
    expect(missing.some((s) => s.id === submission.id)).toBe(true);
  });

  test("a submission approved WITH attribution never shows up in the worklist", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    await approveSubmission(submission.id, { tileId, teamId: team.id, playerId });

    const missing = await getApprovedSubmissionsMissingAttribution(bingo.id);
    expect(missing.some((s) => s.id === submission.id)).toBe(false);
  });

  test("a still-pending submission never shows up in the worklist (approved-only)", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    // Left pending — never approved.
    const missing = await getApprovedSubmissionsMissingAttribution(bingo.id);
    expect(missing.some((s) => s.id === submission.id)).toBe(false);
  });

  test("attributeApprovedSubmission sets player_id and removes it from the worklist", async () => {
    const submission = await insertAndFetchPendingSubmission(bingo.id);
    await approveSubmission(submission.id, { tileId, teamId: team.id });
    expect((await getApprovedSubmissionsMissingAttribution(bingo.id)).some((s) => s.id === submission.id)).toBe(
      true,
    );

    const updated = await attributeApprovedSubmission(submission.id, playerId);
    expect(updated.player_id).toBe(playerId);
    expect(updated.status).toBe("approved"); // unchanged — this never re-triggers approval

    const missingAfter = await getApprovedSubmissionsMissingAttribution(bingo.id);
    expect(missingAfter.some((s) => s.id === submission.id)).toBe(false);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
