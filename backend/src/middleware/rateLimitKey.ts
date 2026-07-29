import { Request } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/jwt.js";

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
 * verified independently here rather than trusting `req.user`.
 *
 * Deliberately uses `jwt.verify`, not `jwt.decode`: decoding without
 * verifying the signature would let anyone put an arbitrary `id` claim into
 * an unsigned/garbage token and deliberately exhaust a specific victim
 * user's bucket instead of their own. Any invalid, expired, malformed, or
 * absent token falls through to IP keying, same as an anonymous caller.
 *
 * IP fallback note: express-rate-limit is pinned to 7.5.1 here (see
 * backend/package.json / bun.lock) — the `ipKeyGenerator` IPv6-subnet
 * helper TEAM-BRIEF.md names does not exist in the 7.x line at all (it
 * ships starting in 8.0.0; confirmed against the installed package and via
 * a scratch install of 8.6.1 — see Sprint 16 backend report). v7's own
 * *default* keyGenerator uses raw `request.ip` for IPv6 exactly like this
 * fallback does, and that is exactly what the other three IP-keyed
 * limiters already in index.ts (login/invite/hiscores-lookup) rely on — so
 * this fallback carries no new IPv6 weakness relative to the rest of the
 * file. Upgrading to v8 for real IPv6 subnet-aware keying across all four
 * limiters is a reasonable follow-up but is a bigger, cross-cutting change
 * than this sprint's fix.
 */
export function rateLimitKey(req: Request): string {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { id?: string };
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // Invalid/expired/forged token, or JWT_SECRET misconfigured — fall
      // through to IP keying below, same treatment as an anonymous caller.
    }
  }

  return `ip:${req.ip ?? "unknown"}`;
}
