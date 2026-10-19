import { describe, expect, test } from "bun:test";
import { getHiscoreHistoryDeletionDate } from "../../src/services/bingoLifecycle.js";

const now = new Date("2026-10-19T12:00:00Z");
const complete = { status: "complete", endDate: "2026-10-17T12:00:00Z", updatedAt: "2026-10-18T12:00:00Z" };

describe("hiscore history retention notice", () => {
  test("five days after the configured end, even when manually completed early", () => {
    expect(getHiscoreHistoryDeletionDate(complete, now)).toBe("2026-10-22T12:00:00.000Z");
  });
  test("active, draft, archived and missing bingos have no notice", () => {
    for (const status of ["active", "draft", "archived"]) {
      expect(getHiscoreHistoryDeletionDate({ ...complete, status }, now)).toBeNull();
    }
    expect(getHiscoreHistoryDeletionDate(null, now)).toBeNull();
  });
  test("early-ended bingo with no end date uses completion updated_at", () => {
    expect(getHiscoreHistoryDeletionDate({ ...complete, endDate: null }, now)).toBe("2026-10-23T12:00:00.000Z");
  });
  test("notice expires strictly after the deletion time", () => {
    expect(getHiscoreHistoryDeletionDate(complete, new Date("2026-10-22T12:00:00Z"))).not.toBeNull();
    expect(getHiscoreHistoryDeletionDate(complete, new Date("2026-10-22T12:00:00.001Z"))).toBeNull();
  });
  test("editing end_date after completion delays the deadline", () => {
    expect(getHiscoreHistoryDeletionDate({ ...complete, endDate: "2026-10-20T12:00:00Z" }, now)).toBe("2026-10-25T12:00:00.000Z");
  });
});
