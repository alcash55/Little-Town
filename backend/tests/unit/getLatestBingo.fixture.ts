/**
 * getLatestBingo() (TEAM-BRIEF.md Sprint 15, Track A — backs
 * GET /api/admin/bingo/latest). Pure unit test: mocks db/client.ts's
 * getDb() so the exact "no bingo has ever been created -> null" contract
 * case can be proven deterministically — the real local Supabase stack is
 * shared across every integration test file and can't reliably be asserted
 * to contain zero bingos (TEAM-BRIEF.md Environment: "No supabase db
 * reset"). The non-null mapping case is covered end-to-end against the real
 * stack in tests/integration/bingo-latest.test.ts; this file only proves
 * the query shape (status-unfiltered, newest-first, limit 1) and the null
 * case in isolation.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";

interface FakeQuery {
  order: (col: string, opts: { ascending: boolean }) => FakeQuery;
  limit: (n: number) => FakeQuery;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
}

let nextResult: { data: unknown; error: null } = { data: null, error: null };
const orderMock = mock((_col: string, _opts: { ascending: boolean }) => query);
const limitMock = mock((_n: number) => query);
const maybeSingleMock = mock(async () => nextResult);
const query: FakeQuery = { order: orderMock, limit: limitMock, maybeSingle: maybeSingleMock };

const selectMock = mock((_cols: string) => query);
const fromMock = mock((_table: string) => ({ select: selectMock }));

mock.module("../../src/db/client.js", () => ({
  getDb: () => ({ from: fromMock }),
}));

const { getLatestBingo } = await import("../../src/db/bingos.js");

beforeEach(() => {
  orderMock.mockClear();
  limitMock.mockClear();
  maybeSingleMock.mockClear();
  selectMock.mockClear();
  fromMock.mockClear();
  nextResult = { data: null, error: null };
});

describe("getLatestBingo", () => {
  test("no bingo has ever been created -> null (not an error, not undefined)", async () => {
    nextResult = { data: null, error: null };
    const result = await getLatestBingo();
    expect(result).toBeNull();
  });

  test("queries newest-first with limit 1, and does NOT filter by status at all", async () => {
    nextResult = { data: null, error: null };
    await getLatestBingo();

    expect(fromMock).toHaveBeenCalledWith("bingos");
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(1);
    // Unlike getActiveBingo(), no `.in("status", [...])` / `.eq("status", ...)`
    // call exists anywhere in this chain — the mock query object above only
    // exposes order/limit/maybeSingle, so any status filter attempted by the
    // implementation would throw as "not a function" and fail this test.
  });

  test("a 'complete' bingo IS returned (the whole point of this function vs. getActiveBingo)", async () => {
    nextResult = {
      data: {
        id: "bingo-latest-1",
        name: "Ended Bingo",
        description: null,
        status: "complete",
        start_date: "2026-06-01T00:00:00.000Z",
        end_date: "2026-06-30T00:00:00.000Z",
        board_size: 16,
        created_by: null,
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
        bingo_teams: [],
        bingo_board_tiles: [],
      },
      error: null,
    };
    const result = await getLatestBingo();
    expect(result).not.toBeNull();
    expect(result!.status).toBe("complete");
    expect(result!.name).toBe("Ended Bingo");
    expect(result!.endDate).toBe("2026-06-30T00:00:00.000Z");
  });
});
