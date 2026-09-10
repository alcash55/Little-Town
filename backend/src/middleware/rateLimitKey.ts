import { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/jwt.js";
import { getRequestToken } from "../lib/session.js";

/**
 * Rate-limit key generator for the general `/api/` limiter (TEAM-BRIEF.md
 * Sprint 16, Track C). An authenticated caller gets their own bucket keyed
 * by user id, so several admins sharing one office/VPN IP no longer share a
 * single bucket. Unauthenticated callers (no bearer token, or one that
 * fails verification) fall back to per-IP keying — unchanged from before.
 *
 * Sequencing: the limiter this feeds is mounted at
 * `app.use("/api/", limiter)`, which runs BEFORE `protect` — `req.user` is
 * never populated by the time this runs, so the bearer token is read and
 * verified independently here rather than trusting `req.user`. Reads the
 * same cookie-or-header source `protect` uses (getRequestToken, issue #53)
 * so a cookie-authenticated browser caller still gets its own per-user
 * bucket instead of falling back to shared IP keying.
 *
 * Deliberately uses `jwt.verify`, not `jwt.decode`: decoding without
 * verifying the signature would let anyone put an arbitrary `id` claim into
 * an unsigned/garbage token and deliberately exhaust a specific victim
 * user's bucket instead of their own. Any invalid, expired, malformed, or
 * absent token falls through to IP keying, same as an anonymous caller.
 *
 * IP fallback note (#45): express-rate-limit is now on 8.x, so the IP
 * fallback goes through `ipKeyGenerator`, which normalizes an IPv6 address
 * to its /64 prefix instead of keying on the full 128-bit address. A raw
 * IPv6 address is unstable per-request for a lot of real clients (privacy
 * extensions, per-request assignment from some ISPs/VPNs), and a caller who
 * gets a new address on every single request was landing in a fresh,
 * always-empty bucket, silently escaping the limit entirely. `req.ip` is
 * fine as-is for IPv4, so this only changes behavior for the IPv6 case —
 * see rateLimitKey.test.ts for both.
 */
export function rateLimitKey(req: Request): string {
  const token = getRequestToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { id?: string };
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // Invalid/expired/forged token, or JWT_SECRET misconfigured — fall
      // through to IP keying below, same treatment as an anonymous caller.
    }
  }

  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}
