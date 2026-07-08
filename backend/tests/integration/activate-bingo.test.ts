import { describe, test, expect, afterAll } from "bun:test";

import { activateBingo } from "../../src/db/bingos.js";
import {
  getLocalStackConfig,
  hasPreexistingActiveBingo,
  insertTestBingo,
  deleteTestBingo,
  getBingoRow,
  uniqueSuffix,
  type BingoRow,
} from "./helpers.js";

const stack = await getLocalStackConfig();
if (!stack.reachable) {
  console.warn(`[activate-bingo.test.ts] skipping: ${stack.reason}`);
}

// uq_bingos_one_active is a single partial unique index across the whole
// bingos table (not scoped to our test rows), so if some other bingo in the
// shared local stack is already active, these assertions would be invalid —
// skip rather than produce a flaky/false failure.
const preexistingActive = stack.reachable ? await hasPreexistingActiveBingo() : false;
if (stack.reachable && preexistingActive) {
  console.warn(
    "[activate-bingo.test.ts] skipping: another bingo is already active in the shared local " +
      "stack, which would make uq_bingos_one_active assertions unreliable",
  );
}

const suite = stack.reachable && !preexistingActive;
const createdBingoIds: string[] = [];

describe.skipIf(!suite)("activate_bingo (draft -> active transitions)", () => {
  let draftA: BingoRow;
  let draftB: BingoRow;

  test("fixtures: two independent draft bingos", async () => {
    draftA = await insertTestBingo(`test-activate-a-${uniqueSuffix()}`);
    draftB = await insertTestBingo(`test-activate-b-${uniqueSuffix()}`);
    createdBingoIds.push(draftA.id, draftB.id);

    expect(draftA.status).toBe("draft");
    expect(draftB.status).toBe("draft");
  });

  test("draft -> active succeeds once and sets start_date", async () => {
    const activated = await activateBingo(draftA.id);
    expect(activated).toBe(true);

    const row = await getBingoRow(draftA.id);
    expect(row.status).toBe("active");
    expect(row.start_date).not.toBeNull();
  });

  test("repeat activation of the same (now-active) bingo is a no-op (false)", async () => {
    const activated = await activateBingo(draftA.id);
    expect(activated).toBe(false);

    const row = await getBingoRow(draftA.id);
    expect(row.status).toBe("active");
  });

  test("a second bingo cannot activate while another is active (uq_bingos_one_active)", async () => {
    const activated = await activateBingo(draftB.id);
    expect(activated).toBe(false);

    const row = await getBingoRow(draftB.id);
    expect(row.status).toBe("draft");
  });

  test("activating a nonexistent bingo id returns false rather than throwing", async () => {
    const activated = await activateBingo("00000000-0000-0000-0000-000000000000");
    expect(activated).toBe(false);
  });
});

afterAll(async () => {
  if (!stack.reachable) return;
  await Promise.all(createdBingoIds.map((id) => deleteTestBingo(id).catch(() => undefined)));
});
