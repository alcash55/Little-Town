/**
 * TEAM-BRIEF.md Sprint 16, Track A item A3.
 * Pure unit test — assertEnvironmentSafety() only reads process.env and
 * throws/warns/returns; no DB, no network, no mocks needed.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { assertEnvironmentSafety } from "../../src/config/envGuard.js";

const ENV_KEYS = ["NODE_ENV", "SUPABASE_URL", "ALLOW_REMOTE_DB"] as const;
let saved: Record<(typeof ENV_KEYS)[number], string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])) as typeof saved;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("assertEnvironmentSafety", () => {
  test("local SUPABASE_URL (127.0.0.1) in development does not throw", () => {
    process.env.NODE_ENV = "development";
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    delete process.env.ALLOW_REMOTE_DB;

    expect(() => assertEnvironmentSafety()).not.toThrow();
  });

  test("local SUPABASE_URL (localhost hostname) in development does not throw", () => {
    process.env.NODE_ENV = "development";
    process.env.SUPABASE_URL = "http://localhost:54321";
    delete process.env.ALLOW_REMOTE_DB;

    expect(() => assertEnvironmentSafety()).not.toThrow();
  });

  test("remote SUPABASE_URL in development throws", () => {
    process.env.NODE_ENV = "development";
    process.env.SUPABASE_URL = "https://faqivcgrhrvuwpistivp.supabase.co";
    delete process.env.ALLOW_REMOTE_DB;

    expect(() => assertEnvironmentSafety()).toThrow(/Refusing to start/);
  });

  test("remote SUPABASE_URL in development with ALLOW_REMOTE_DB=true warns and passes", () => {
    process.env.NODE_ENV = "development";
    process.env.SUPABASE_URL = "https://faqivcgrhrvuwpistivp.supabase.co";
    process.env.ALLOW_REMOTE_DB = "true";
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    expect(() => assertEnvironmentSafety()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    const banner = warnSpy.mock.calls[0][0] as string;
    expect(banner).toMatch(/WARNING/);
    expect(banner).toContain("faqivcgrhrvuwpistivp.supabase.co");

    warnSpy.mockRestore();
  });

  test("remote SUPABASE_URL in production does not throw (Render must boot normally)", () => {
    process.env.NODE_ENV = "production";
    process.env.SUPABASE_URL = "https://faqivcgrhrvuwpistivp.supabase.co";
    delete process.env.ALLOW_REMOTE_DB;

    expect(() => assertEnvironmentSafety()).not.toThrow();
  });

  test("missing SUPABASE_URL in development throws (fails closed, does not treat unset as local)", () => {
    process.env.NODE_ENV = "development";
    delete process.env.SUPABASE_URL;
    delete process.env.ALLOW_REMOTE_DB;

    expect(() => assertEnvironmentSafety()).toThrow(/Refusing to start/);
  });

  test("ALLOW_REMOTE_DB is ignored (still throws) when not exactly 'true'", () => {
    process.env.NODE_ENV = "development";
    process.env.SUPABASE_URL = "https://faqivcgrhrvuwpistivp.supabase.co";
    process.env.ALLOW_REMOTE_DB = "1";

    expect(() => assertEnvironmentSafety()).toThrow(/Refusing to start/);
  });
});
