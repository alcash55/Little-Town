import rateLimit, { Options } from "express-rate-limit";

/**
 * Stricter limiter on POST /api/auth/login to slow down credential
 * stuffing/brute force — fixed 15 min window regardless of
 * RATE_LIMIT_WINDOW_MS (see index.ts's general `/api/` limiter for why that
 * one is configurable and this one deliberately isn't).
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
  max: 10, // limit each IP to 10 login attempts per 15 minutes
  message: {
    error: "Too many login attempts from this IP, please try again later.",
  },
};

export const loginLimiter = rateLimit(loginLimiterOptions);
