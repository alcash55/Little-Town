/**
 * Direct unit coverage for the login rate limit override (#86). A fixed 10
 * attempts per 15 minutes blocks scripted end-to-end suites that log in
 * more than 10 times inside one window, so LOGIN_RATE_LIMIT_MAX_OVERRIDE
 * makes the ceiling configurable outside production. resolveLoginRateLimitMax
 * takes an env object directly instead of mutating process.env, since bun
 * caches loginLimiter.ts's own module-load-time `max` per process and a
 * second import wouldn't re-read a changed process.env anyway.
 */
import { describe, expect, test } from "bun:test";

import {
  DEFAULT_LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_MAX_CEILING,
  resolveLoginRateLimitMax,
} from "../../src/middleware/loginLimiter.js";

describe("resolveLoginRateLimitMax (#86)", () => {
  test("no override set: falls back to the fixed default", () => {
    expect(resolveLoginRateLimitMax({})).toBe(DEFAULT_LOGIN_RATE_LIMIT_MAX);
  });

  test("override set outside production: applies the override", () => {
    expect(
      resolveLoginRateLimitMax({ NODE_ENV: "development", LOGIN_RATE_LIMIT_MAX_OVERRIDE: "50" }),
    ).toBe(50);
  });

  test("override above the ceiling: clamped, not honored outright", () => {
    expect(
      resolveLoginRateLimitMax({ NODE_ENV: "development", LOGIN_RATE_LIMIT_MAX_OVERRIDE: "999999" }),
    ).toBe(LOGIN_RATE_LIMIT_MAX_CEILING);
  });

  test("override set in production: ignored, production always gets the default", () => {
    expect(
      resolveLoginRateLimitMax({ NODE_ENV: "production", LOGIN_RATE_LIMIT_MAX_OVERRIDE: "500" }),
    ).toBe(DEFAULT_LOGIN_RATE_LIMIT_MAX);
  });

  test.each(["0", "-5", "not-a-number", ""])(
    "invalid override %j: falls back to the default rather than throwing",
    (value) => {
      expect(
        resolveLoginRateLimitMax({ NODE_ENV: "development", LOGIN_RATE_LIMIT_MAX_OVERRIDE: value }),
      ).toBe(DEFAULT_LOGIN_RATE_LIMIT_MAX);
    },
  );
});
