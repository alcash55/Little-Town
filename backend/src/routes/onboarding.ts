import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { protect } from "../middleware/auth.js";
import { validateBody, rsnClaimSchema } from "../lib/validation.js";
import { canonicalizeRsn, normalizeRsn, isPlausibleRsn } from "../lib/rsn.js";
import { hiscores } from "../services/hiscores.js";
import { getActiveBingo } from "../db/bingos.js";
import { registerBingoPlayer, findBingoPlayerCaseInsensitive } from "../db/players.js";
import { findRsnClaim, upsertRsnClaim } from "../db/rsnClaims.js";

const router = Router();

router.use(protect);

// Same treatment as the public hiscores proxy (routes/hiscores.ts's
// hiscoresLookupLimiter): this route also drives a server-side OSRS
// hiscores lookup on every call, so it's just as capable of being used to
// hammer the upstream API — being authed doesn't change that, it just
// means the abuser needs an account first. Tighter than the public
// proxy's 30/min since a legitimate caller only ever needs this a
// handful of times (once per onboarding, occasionally to fix a typo).
const rsnClaimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.ONBOARDING_RSN_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many RSN claim attempts, please try again shortly.", code: "RATE_LIMITED" },
});

// -------------------------------------------------------
// POST /api/onboarding/rsn — frozen contract, TEAM-BRIEF.md Sprint 11,
// Track A. Body { rsn }. Effective-user aware: req.user is whatever
// `protect`'s impersonation step resolved it to, so an admin impersonating
// a user claims on that user's behalf, exactly like every other
// protect-gated route.
//
// See supabase/migrations/20260715000000_rsn_claims.sql for the full
// design writeup of what "claimed" means and the sprint report for the
// abuse-guard assessment. Summary of this handler's steps:
//   1. Canonicalize + shape-check the RSN (cheap, no network call for
//      obviously-bogus input).
//   2. Validate against the OSRS hiscores server-side (never trust the
//      client's own validation) -> 422 RSN_NOT_FOUND if it doesn't resolve,
//      503 HISCORES_SERVICE_UNAVAILABLE if the upstream lookup itself fails.
//   3. Require an active/draft bingo to register into (this endpoint's
//      whole point is landing the caller in the CURRENT drafter pool) ->
//      404 NO_ACTIVE_BINGO if there isn't one. Checked before writing
//      anything, so a predictable failure here has no side effects.
//   4. Conflict-check: is this RSN already claimed by a different user? ->
//      409 RSN_TAKEN. Re-claiming your own RSN is a no-op 200
//      (idempotent); claiming a different RSN than one you already hold
//      MOVES your claim (one claim per user — see the migration header).
//   5. Create-or-find the bingo_players pool row (case-insensitively, so
//      an admin-pre-registered "zezima" gets LINKED rather than
//      duplicated by a user who types "Zezima") with no team assigned.
// -------------------------------------------------------
router.post(
  "/rsn",
  rsnClaimLimiter,
  validateBody(rsnClaimSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { rsn } = req.body as { rsn: string };
    const userId = req.user!.id;

    const canonical = canonicalizeRsn(rsn);
    if (!isPlausibleRsn(canonical)) {
      // Not a shape any real RSN can take (empty after trimming, too long,
      // disallowed characters) — it cannot possibly resolve on the
      // hiscores, so skip the network round trip and fail the same way a
      // real 404 would.
      throw new AppError(`"${rsn}" is not a valid RuneScape name`, 422, "RSN_NOT_FOUND");
    }

    let hiscoreData;
    try {
      hiscoreData = await hiscores(canonical);
    } catch {
      throw new AppError(
        "The OSRS hiscores service is currently unavailable — try again shortly",
        503,
        "HISCORES_SERVICE_UNAVAILABLE",
      );
    }
    if (!hiscoreData) {
      throw new AppError(`"${canonical}" was not found on the OSRS hiscores`, 422, "RSN_NOT_FOUND");
    }

    const bingo = await getActiveBingo();
    if (!bingo?.id) {
      throw new AppError("No active bingo to register players to", 404, "NO_ACTIVE_BINGO");
    }

    const rsnNormalized = normalizeRsn(canonical);
    const existingClaim = await findRsnClaim(rsnNormalized);
    if (existingClaim && existingClaim.user_id !== userId) {
      throw new AppError(`RSN "${canonical}" is already claimed by another account`, 409, "RSN_TAKEN");
    }

    await upsertRsnClaim(userId, canonical, rsnNormalized);

    const existingPoolEntry = await findBingoPlayerCaseInsensitive(bingo.id, canonical);
    const rsnForPool = existingPoolEntry?.rsn ?? canonical;
    await registerBingoPlayer(bingo.id, rsnForPool, undefined, userId);

    res.status(200).json({
      rsn: canonical,
      tracked: true,
      alreadyTracked: existingPoolEntry !== null,
    });
  }),
);

export default router;
