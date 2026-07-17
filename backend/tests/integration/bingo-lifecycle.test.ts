/**
 * completeEndedBingos() — TEAM-BRIEF.md Sprint 15, Track A item 1/5. Proves
 * the end-of-bingo lifecycle transition end-to-end against the real local
 * stack: before/at/after end_date, idempotency (no double-transition, no
 * repeat Discord notification), draft/already-complete bingos left
 * untouched, and the one-time Discord notification firing exactly when a
 * transitioned bingo still has pending submissions (and never when it
 * doesn't). Discord itself is mocked throughout — services/discordScreenshots.js's
 * notifyBingoEndedWithPendingScreenshots is replaced via mock.module before
 * bingoLifecycle.js is imported, so this file never touches a real bot/token
 * (Environment rule: Discord behavior is tested via mocks only).
 *
 * The same completeEndedBingos() export is what index.ts calls once at
 * server boot (in addition to every stats-cron tick) — there is no separate
 * "boot" code path to test; calling the function directly, as every test
 * below does, IS the boot-time check.
 *
 * `uq_bingos_one_active` allows at most ONE status='active' bingo across the
 * ENTIRE shared local stack at a time — same constraint every other
 * integration test file respects via hasPreexistingActiveBingo(). Tests here
 * that leave their fixture 'active' (i.e. completeEndedBingos correctly did
 * NOT transition it) delete it immediately at the end of that test, rather
 * than deferring to afterAll, so later tests in this same file can claim the
 * slot for their own fixture.
 */
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { getDb } from "../../src/db/client.js";
import { insertPendingSubmission } from "../../src/db/bingoSubmissions.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  getBingoRow,
  uniqueSuffix,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[bingo-lifecycle.test.ts] skipping: ${stack.reason}`);
}
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn("[bingo-lifecycle.test.ts] skipping: another bingo is already active in the shared local stack");
}
const suite = stack.reachable && !preexistingActive;

const notifyMock = mock(async (_bingoName: string, _pendingCount: number) => {});

mock.module("../../src/services/discordScreenshots.js", () => ({
  notifyBingoEndedWithPendingScreenshots: notifyMock,
}));

// Imported dynamically *after* the mock above is registered so
// bingoLifecycle.js resolves the mocked discordScreenshots module rather
// than the real one (which would try to touch a live Discord client).
const { completeEndedBingos } = await import("../../src/services/bingoLifecycle.js");

const createdBingoIds: string[] = [];

async function insertPendingSubmissionRow(bingoId: string): Promise<void> {
  const discordMessageId = `lifecycle-${uniqueSuffix()}`;
  await insertPendingSubmission({ bingoId, discordMessageId, imagePath: `test/${discordMessageId}.png` });
}

beforeEach(() => {
  notifyMock.mockClear();
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});

describe.skipIf(!suite)("completeEndedBingos", () => {
  test("an active bingo whose end_date is in the past transitions to 'complete', logged loudly", async () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-lifecycle-past-${uniqueSuffix()}`, {
      status: "active",
      end_date: pastEnd,
    });
    createdBingoIds.push(bingo.id);

    const results = await completeEndedBingos();

    expect(results.some((r) => r.id === bingo.id)).toBe(true);
    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("complete");
    // Frees the active slot for the next test — already non-active here, no
    // extra cleanup needed.
  });

  test("an active bingo whose end_date is in the future is left untouched (and is deleted immediately after, to free the one-active-bingo slot)", async () => {
    const futureEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-lifecycle-future-${uniqueSuffix()}`, {
      status: "active",
      end_date: futureEnd,
    });

    const results = await completeEndedBingos();

    expect(results.some((r) => r.id === bingo.id)).toBe(false);
    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("active");

    await deleteTestBingo(bingo.id);
  });

  test("an active bingo whose end_date is EXACTLY now is left untouched (strict '<', not '<=' — matches isBingoPastEnd)", async () => {
    const now = new Date();
    const bingo = await insertTestBingo(`test-lifecycle-exact-${uniqueSuffix()}`, {
      status: "active",
      end_date: now.toISOString(),
    });

    const results = await completeEndedBingos(now);

    expect(results.some((r) => r.id === bingo.id)).toBe(false);
    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("active");

    await deleteTestBingo(bingo.id);
  });

  test("a draft bingo past its (unrelated) start_date is never touched — this check only ever looks at status='active'", async () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-lifecycle-draft-${uniqueSuffix()}`, {
      status: "draft",
      end_date: pastEnd,
    });
    createdBingoIds.push(bingo.id);

    const results = await completeEndedBingos();

    expect(results.some((r) => r.id === bingo.id)).toBe(false);
    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("draft");
  });

  test("an already-complete bingo is never re-processed", async () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-lifecycle-already-complete-${uniqueSuffix()}`, {
      status: "complete",
      end_date: pastEnd,
    });
    createdBingoIds.push(bingo.id);

    const results = await completeEndedBingos();

    expect(results.some((r) => r.id === bingo.id)).toBe(false);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  test("idempotency: calling completeEndedBingos() twice in a row only transitions + notifies once", async () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-lifecycle-idempotent-${uniqueSuffix()}`, {
      status: "active",
      end_date: pastEnd,
    });
    createdBingoIds.push(bingo.id);
    await insertPendingSubmissionRow(bingo.id);

    const first = await completeEndedBingos();
    expect(first.some((r) => r.id === bingo.id)).toBe(true);
    expect(notifyMock).toHaveBeenCalledTimes(1);

    const second = await completeEndedBingos();
    expect(second.some((r) => r.id === bingo.id)).toBe(false);
    // Still exactly once total across both calls — the second call's query
    // no longer matches this bingo (status is already 'complete'), so the
    // notification is never re-fired on a later tick.
    expect(notifyMock).toHaveBeenCalledTimes(1);

    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("complete");
  });

  test("pending submissions survive the transition and are counted correctly in the result + passed to the Discord notification", async () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-lifecycle-pending-${uniqueSuffix()}`, {
      status: "active",
      end_date: pastEnd,
    });
    createdBingoIds.push(bingo.id);
    await insertPendingSubmissionRow(bingo.id);
    await insertPendingSubmissionRow(bingo.id);

    const results = await completeEndedBingos();
    const result = results.find((r) => r.id === bingo.id)!;
    expect(result.pendingCount).toBe(2);

    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0]).toEqual([bingo.name, 2]);

    // Submissions themselves are untouched — still pending, not deleted or
    // auto-resolved by the transition (product decision 2).
    const { data: subs, error } = await getDb()
      .from("bingo_submissions")
      .select("status")
      .eq("bingo_id", bingo.id);
    if (error) throw new Error(error.message);
    expect(subs?.every((s: { status: string }) => s.status === "pending")).toBe(true);
  });

  test("a transitioned bingo with ZERO pending submissions never fires the Discord notification", async () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-lifecycle-nopending-${uniqueSuffix()}`, {
      status: "active",
      end_date: pastEnd,
    });
    createdBingoIds.push(bingo.id);

    const results = await completeEndedBingos();
    const result = results.find((r) => r.id === bingo.id)!;
    expect(result.pendingCount).toBe(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  test("acts as the boot-time check: a bare completeEndedBingos() call (same as index.ts's app.listen callback) is sufficient on its own — no separate wiring needed", async () => {
    const pastEnd = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const bingo = await insertTestBingo(`test-lifecycle-boot-${uniqueSuffix()}`, {
      status: "active",
      end_date: pastEnd,
    });
    createdBingoIds.push(bingo.id);

    // Exactly what index.ts's app.listen callback does.
    await completeEndedBingos().catch((e) => {
      throw new Error(`boot-time lifecycle check must never throw: ${e}`);
    });

    const row = await getBingoRow(bingo.id);
    expect(row.status).toBe("complete");
  });
});
