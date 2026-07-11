/**
 * Activation semantics (TEAM-BRIEF.md Sprint 5, Track A item 2) and the
 * retake-start-snapshots idempotency it depends on.
 *
 * Runs against the real bingos/bingo_players/bingo_player_hiscores/
 * rsn_change_log tables on the local Supabase stack — only
 * services/hiscores.ts (the real OSRS network call) is mocked, so this
 * exercises the actual Postgres-backed draft->active transition and
 * snapshot-row idempotency the admin routes rely on, not just in-memory
 * logic.
 *
 * One flowing describe block (rather than several independent ones) because
 * uq_bingos_one_active only allows a single active bingo across the whole
 * shared local stack at a time — reusing the same bingo end-to-end (draft ->
 * blocked -> forced active -> retake) avoids fighting that constraint the
 * way two independently-activated fixture bingos would.
 */
import { describe, test, expect, afterAll, beforeEach, mock } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { registerBingoPlayer, type BingoPlayer } from "../../src/db/players.js";
import type { HiscoreData } from "../../src/types/index.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  getBingoRow,
  countHiscoreRows,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[activation-force.test.ts] skipping: ${stack.reason}`);
}
// uq_bingos_one_active is a single partial unique index across the whole
// bingos table — see activate-bingo.test.ts for why this must skip rather
// than flake when some other bingo in the shared local stack is active.
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[activation-force.test.ts] skipping: another bingo is already active in the shared local stack",
  );
}
const suite = stack.reachable && !preexistingActive;

// -------------------------------------------------------
// Mock services/hiscores.ts — the only network-touching dependency of
// bingoActivation.ts. Everything else in this file hits the real local DB.
// -------------------------------------------------------

function fakeHiscoreData(name: string): HiscoreData {
  return {
    name,
    skills: [{ id: 0, name: "Overall", rank: 1, level: 1, xp: 0 }],
    activities: [],
    updatedAt: new Date(),
  };
}

/** RSNs in this set 404 on the mocked hiscores lookup; everything else resolves. */
const unresolvableRsns = new Set<string>();

const hiscoresMock = mock(async (rsn: string): Promise<HiscoreData | null> => {
  if (unresolvableRsns.has(rsn)) return null;
  return fakeHiscoreData(rsn);
});

mock.module("../../src/services/hiscores.js", () => ({ hiscores: hiscoresMock }));

// Imported dynamically *after* the mock above is registered so
// bingoActivation.js resolves the mocked hiscores module.
const { activateBingoWithSnapshots, snapshotStartAndCurrent } = await import(
  "../../src/services/bingoActivation.js"
);
const { getBingoPlayers } = await import("../../src/db/players.js");

beforeEach(() => {
  hiscoresMock.mockClear();
});

const createdBingoIds: string[] = [];

describe.skipIf(!suite)("activateBingoWithSnapshots + snapshotStartAndCurrent (retake)", () => {
  let bingo: BingoRow;
  let goodPlayer: BingoPlayer;
  let badPlayer: BingoPlayer;
  let badRsn: string;

  test("fixtures: draft bingo with one resolvable and one unresolvable player", async () => {
    bingo = await insertTestBingo(`test-activation-force-${uniqueSuffix()}`);
    createdBingoIds.push(bingo.id);
    const goodRsn = `ActivationGood${uniqueSuffix()}`;
    badRsn = `ActivationBad${uniqueSuffix()}`;
    unresolvableRsns.add(badRsn);

    goodPlayer = await registerBingoPlayer(bingo.id, goodRsn);
    badPlayer = await registerBingoPlayer(bingo.id, badRsn);
    // registerBingoPlayer only ever fetches a "start"/"current" snapshot at
    // registration time when passed real hiscore data; the fixture inserts
    // rows directly so neither player has a snapshot yet.
    expect(await countHiscoreRows(goodPlayer.id, "start")).toBe(0);
    expect(await countHiscoreRows(badPlayer.id, "start")).toBe(0);
  });

  test("without force: blocked, bingo stays draft, but the good player's snapshot is still saved", async () => {
    const outcome = await activateBingoWithSnapshots(bingo.id, { source: "drafter" });

    expect(outcome.blocked).toBe(true);
    expect(outcome.activated).toBe(false);
    expect(outcome.succeeded).toBe(1);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0]).toContain(badRsn);

    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("draft");

    // Best-effort partial progress: the good player's snapshot was still
    // taken even though activation itself was withheld.
    expect(await countHiscoreRows(goodPlayer.id, "start")).toBe(1);
    expect(await countHiscoreRows(badPlayer.id, "start")).toBe(0);
  });

  test("force: true activates anyway despite the same failure", async () => {
    const outcome = await activateBingoWithSnapshots(bingo.id, { force: true, source: "drafter" });

    expect(outcome.blocked).toBe(false);
    expect(outcome.activated).toBe(true);
    expect(outcome.failed).toHaveLength(1);

    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("active");
    expect(row.start_date).not.toBeNull();
  });

  test("a repeat forced activation call loses the race (already active) — activated: false, blocked: false", async () => {
    const outcome = await activateBingoWithSnapshots(bingo.id, { force: true, source: "drafter" });
    expect(outcome.activated).toBe(false);
    expect(outcome.blocked).toBe(false); // distinct from the earlier "withheld" case
  });

  test("badPlayer is confirmed as still missing a start snapshot on the now-active bingo", async () => {
    const rows = await getBingoPlayers(bingo.id);
    expect(rows.map((p) => p.rsn)).toContain(badRsn);
    expect(await countHiscoreRows(badPlayer.id, "start")).toBe(0);
  });

  test("retake-start-snapshots equivalent while still unresolvable: no snapshot, RSN change logged", async () => {
    const { succeeded, failed } = await snapshotStartAndCurrent([badPlayer], "drafter");
    expect(succeeded).toBe(0);
    expect(failed).toHaveLength(1);
    expect(await countHiscoreRows(badPlayer.id, "start")).toBe(0);

    const { data } = await getDb()
      .from("rsn_change_log")
      .select("resolved_at")
      .eq("player_id", badPlayer.id)
      .is("resolved_at", null)
      .maybeSingle();
    expect(data).not.toBeNull();
  });

  test("retake after the RSN starts resolving: snapshot is taken exactly once", async () => {
    unresolvableRsns.delete(badRsn);

    const first = await snapshotStartAndCurrent([badPlayer], "drafter");
    expect(first.succeeded).toBe(1);
    expect(await countHiscoreRows(badPlayer.id, "start")).toBe(1);

    // The rsn_change_log entry from the earlier failure auto-resolves now
    // that the lookup succeeds again.
    const { data } = await getDb()
      .from("rsn_change_log")
      .select("resolved_at")
      .eq("player_id", badPlayer.id)
      .is("resolved_at", null)
      .maybeSingle();
    expect(data).toBeNull();

    // Idempotency: calling again must not create a duplicate start row.
    const second = await snapshotStartAndCurrent([badPlayer], "drafter");
    expect(second.succeeded).toBe(1);
    expect(await countHiscoreRows(badPlayer.id, "start")).toBe(1);
  });

  test("calling with an empty player list is a no-op, not an error", async () => {
    const outcome = await snapshotStartAndCurrent([], "drafter");
    expect(outcome).toEqual({ succeeded: 0, failed: [], results: [] });
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
