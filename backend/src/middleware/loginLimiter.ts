import rateLimit, { Options } from "express-rate-limit";

/** Login attempts allowed per IP per window in production, and the non-production default. */
export const DEFAULT_LOGIN_RATE_LIMIT_MAX = 10;

/**
 * Ceiling on LOGIN_RATE_LIMIT_MAX_OVERRIDE (#86). A scripted end-to-end
 * suite logging in repeatedly needs more than 10 attempts per 15 minutes,
 * but the override still has to slow down credential stuffing on a shared
 * dev/staging box, not switch it off. 300 covers a full test suite retrying
 * through transient failures with headroom to spare, without being "no
 * limit" in practice. Same bounded-widening shape as #49's dev CORS port
 * range (config/cors.ts) — the fix for "the limit gets in the way" is a
 * wider allowance, not an open gate.
 */
export const LOGIN_RATE_LIMIT_MAX_CEILING = 300;

/**
 * Resolves the login attempt ceiling for the current process. Production
 * always gets the fixed default, full stop — LOGIN_RATE_LIMIT_MAX_OVERRIDE
 * is read only outside it, and an unset, non-numeric, or non-positive value
 * also falls back to the default. Exported for direct unit testing without
 * needing to reimport this module per environment (bun caches ES modules
 * per process).
 */
export function resolveLoginRateLimitMax(env: NodeJS.ProcessEnv = process.env): number {
  if (env.NODE_ENV === "production") return DEFAULT_LOGIN_RATE_LIMIT_MAX;

  const override = Number(env.LOGIN_RATE_LIMIT_MAX_OVERRIDE);
  if (!Number.isFinite(override) || override <= 0) return DEFAULT_LOGIN_RATE_LIMIT_MAX;

  return Math.min(override, LOGIN_RATE_LIMIT_MAX_CEILING);
}

/**
 * Stricter limiter on POST /api/auth/login to slow down credential
 * stuffing/brute force — fixed 15 min window regardless of
 * RATE_LIMIT_WINDOW_MS (see index.ts's general `/api/` limiter for why that
 * one is configurable and this one deliberately isn't). `max` is
 * overridable outside production only (#86) — a fixed 10 blocked scripted
 * end-to-end tests that log in more than 10 times inside one window.
 *
 * Extracted to its own module (rather than declared inline in index.ts,
 * where it originally lived) so tests/integration/login.test.ts can build
 * against the exact same config instead of re-declaring the numbers and
 * risking drift — see issue #52. The options are exported separately from
 * the instantiated middleware so that test can construct its own fresh
 * `rateLimit(loginLimiterOptions)` instance with an empty bucket, rather
 * than sharing (and being polluted by) this module's own singleton, which
 * every other test file that imports authRoutes also exercises requests
 * against.
 */
export const loginLimiterOptions: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  max: resolveLoginRateLimitMax(),
  message: {
    error: "Too many login attempts from this IP, please try again later.",
  },
};

export const loginLimiter = rateLimit(loginLimiterOptions);
