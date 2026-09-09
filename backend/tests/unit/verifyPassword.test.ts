/**
 * Issue #52: verifyPassword (src/db/users.ts) had zero test coverage before
 * this file. Two independent branches, both security-critical:
 *
 *   - A real user: bcrypt.compare against a proper hash.
 *   - The `dev:`-prefixed fixture branch: a plaintext comparison, gated on
 *     ALLOW_DEV_AUTH === "true" AND NODE_ENV === "development" (see issue
 *     #51's hardening of isDevAuthBypassEnabled — this is the gate that
 *     matters most, since a single dropped condition here would turn a
 *     local-dev convenience into a production credential bypass).
 *
 * All four ALLOW_DEV_AUTH x NODE_ENV combinations relevant to the gate are
 * pinned explicitly, same pattern as tests/integration/devAuthBypass.test.ts
 * uses for protect's no-token bypass.
 *
 * Pure unit test — no DB, no network. bcrypt.compare itself isn't
 * re-verified here (that's bcrypt's own test suite's job); what's under
 * test is verifyPassword's branch selection and the dev-bypass gate.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import bcrypt from "bcrypt";
import { verifyPassword } from "../../src/db/users.js";

const ENV_KEYS = ["NODE_ENV", "ALLOW_DEV_AUTH"] as const;
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

describe("verifyPassword — real users (bcrypt branch)", () => {
  test("correct password against its own bcrypt hash succeeds", async () => {
    const hash = await bcrypt.hash("correct horse battery staple", 12);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  test("wrong password against a real bcrypt hash fails", async () => {
    const hash = await bcrypt.hash("correct horse battery staple", 12);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  test("empty password against a real bcrypt hash fails", async () => {
    const hash = await bcrypt.hash("correct horse battery staple", 12);
    expect(await verifyPassword("", hash)).toBe(false);
  });
});

describe("verifyPassword — dev:-prefixed fixture branch, all four gate states", () => {
  test("ALLOW_DEV_AUTH=true, NODE_ENV=development, matching password -> true", async () => {
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "development";
    expect(await verifyPassword("password", "dev:password")).toBe(true);
  });

  test("ALLOW_DEV_AUTH=true, NODE_ENV=development, wrong password -> false", async () => {
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "development";
    expect(await verifyPassword("not-the-password", "dev:password")).toBe(false);
  });

  test("ALLOW_DEV_AUTH=false, NODE_ENV=development -> false regardless of password match", async () => {
    process.env.ALLOW_DEV_AUTH = "false";
    process.env.NODE_ENV = "development";
    expect(await verifyPassword("password", "dev:password")).toBe(false);
  });

  test("ALLOW_DEV_AUTH unset, NODE_ENV=development -> false (bypass is opt-in, not default)", async () => {
    delete process.env.ALLOW_DEV_AUTH;
    process.env.NODE_ENV = "development";
    expect(await verifyPassword("password", "dev:password")).toBe(false);
  });

  test("ALLOW_DEV_AUTH=true, NODE_ENV=production -> false regardless of password match", async () => {
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "production";
    expect(await verifyPassword("password", "dev:password")).toBe(false);
  });

  test("ALLOW_DEV_AUTH=true, NODE_ENV unset -> false (tightened from '!== production' to '=== development')", async () => {
    process.env.ALLOW_DEV_AUTH = "true";
    delete process.env.NODE_ENV;
    expect(await verifyPassword("password", "dev:password")).toBe(false);
  });

  test("ALLOW_DEV_AUTH=true, NODE_ENV=staging -> false (only 'development' qualifies, not merely non-production)", async () => {
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "staging";
    expect(await verifyPassword("password", "dev:password")).toBe(false);
  });

  test("ALLOW_DEV_AUTH=false, NODE_ENV=production -> false (both conditions failing simultaneously)", async () => {
    process.env.ALLOW_DEV_AUTH = "false";
    process.env.NODE_ENV = "production";
    expect(await verifyPassword("password", "dev:password")).toBe(false);
  });
});
