import { describe, test, expect } from "bun:test";

import { canonicalizeRsn, normalizeRsn, isPlausibleRsn } from "../../src/lib/rsn.js";

describe("canonicalizeRsn", () => {
  test("trims leading/trailing whitespace", () => {
    expect(canonicalizeRsn("  Zezima  ")).toBe("Zezima");
  });

  test("collapses internal whitespace runs to a single space", () => {
    expect(canonicalizeRsn("Zez   ima")).toBe("Zez ima");
  });

  test("treats underscores as spaces", () => {
    expect(canonicalizeRsn("Zez_ima")).toBe("Zez ima");
  });

  test("combination: leading/trailing underscores + internal whitespace mess", () => {
    expect(canonicalizeRsn("__Big  Fish_")).toBe("Big Fish");
  });

  test("preserves the caller's capitalization (no lowercasing)", () => {
    expect(canonicalizeRsn("ZeZiMa")).toBe("ZeZiMa");
  });
});

describe("normalizeRsn", () => {
  test("lowercases the canonical form", () => {
    expect(normalizeRsn("Zezima")).toBe("zezima");
  });

  test("two different capitalizations normalize to the same identity key", () => {
    expect(normalizeRsn(canonicalizeRsn("ZEZIMA"))).toBe(normalizeRsn(canonicalizeRsn("zezima")));
  });
});

describe("isPlausibleRsn", () => {
  test.each([["Zezima"], ["Big Fish"], ["A"], ["Player-1"], ["12345678"]])(
    "accepts %s",
    (rsn: string) => {
      expect(isPlausibleRsn(rsn)).toBe(true);
    },
  );

  test("rejects the empty string", () => {
    expect(isPlausibleRsn("")).toBe(false);
  });

  test.each([["Not@Valid"], ["Has#Hash"], ["Bang!"], ["Quote'd"], ["Percent%Sign"]])(
    "rejects %s (disallowed character)",
    (rsn: string) => {
      expect(isPlausibleRsn(rsn)).toBe(false);
    },
  );

  test("rejects a name starting or ending with a space (canonicalizeRsn should have trimmed it first)", () => {
    expect(isPlausibleRsn(" Zezima")).toBe(false);
    expect(isPlausibleRsn("Zezima ")).toBe(false);
  });

  test("rejects a name longer than 40 characters (matches rsnClaimSchema's max)", () => {
    expect(isPlausibleRsn("A".repeat(41))).toBe(false);
  });

  test("accepts exactly 40 characters", () => {
    expect(isPlausibleRsn("A".repeat(40))).toBe(true);
  });
});
