/**
 * Direct unit coverage for rateLimitKey's IPv6 fallback (#45). The bump to
 * express-rate-limit 8.x replaced the raw `req.ip` fallback with
 * `ipKeyGenerator`, which collapses an IPv6 address down to its /64 prefix
 * instead of keying on the full 128-bit address — see rateLimitKey.ts's doc
 * comment for why a per-request address otherwise escapes the limit
 * entirely. tests/unit/rateLimitIdentity.test.ts already covers the
 * user-vs-IP keying end to end over a real IPv4 loopback server; this file
 * is the narrower, IPv6-specific piece that isn't exercised there (a real
 * `http.Server` bound to `127.0.0.1` never sees an IPv6 `req.ip`).
 */
import { describe, expect, test } from "bun:test";
import type { Request } from "express";

process.env.JWT_SECRET = "rate-limit-key-ipv6-test-secret-do-not-use-elsewhere";

const { rateLimitKey } = await import("../../src/middleware/rateLimitKey.js");

/** A bare Request stand-in — rateLimitKey only ever reads `.ip`, headers, and cookies. */
function fakeRequest(ip: string): Request {
  return { ip, headers: {}, cookies: {} } as unknown as Request;
}

describe("rateLimitKey — IPv6 fallback (#45)", () => {
  test("two different IPv6 addresses in the same /64 share a bucket key", () => {
    const a = rateLimitKey(fakeRequest("2001:db8:1234:5678:aaaa:bbbb:cccc:0001"));
    const b = rateLimitKey(fakeRequest("2001:db8:1234:5678:1111:2222:3333:4444"));

    expect(a).toBe(b);
  });

  test("two IPv6 addresses in different /64s get different bucket keys", () => {
    const a = rateLimitKey(fakeRequest("2001:db8:1234:5678::1"));
    const b = rateLimitKey(fakeRequest("2001:db8:1234:9999::1"));

    expect(a).not.toBe(b);
  });

  test("an IPv4 address still keys on the full address, unaffected by the IPv6 change", () => {
    const a = rateLimitKey(fakeRequest("203.0.113.10"));
    const b = rateLimitKey(fakeRequest("203.0.113.11"));

    expect(a).not.toBe(b);
    expect(rateLimitKey(fakeRequest("203.0.113.10"))).toBe(a);
  });
});
