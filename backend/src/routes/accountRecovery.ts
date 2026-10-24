import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler.js";
import { clearAuthCookie } from "../lib/session.js";
import {
  configuredRecoveryDelivery,
  consumeRecovery,
  recoveryPassword,
  recoveryStatus,
  recoveryToken,
  requestRecovery,
  type RecoveryDelivery,
} from "../services/accountRecovery.js";

export const recoveryConfirmation = {
  success: true,
  message:
    "If an account matches that email, a recovery link will be sent. If you have no email on your account, contact a clan admin.",
};

export function createRecoveryRoutes(
  deliver: RecoveryDelivery | undefined = configuredRecoveryDelivery()
) {
  const router = Router();
  const limiter = (limit: number) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        error: "Too many recovery attempts. Try again in 15 minutes.",
      },
    });
  let pending = 0;
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.post("/request", limiter(5), (req, res) => {
    const parsed = z.object({ email: z.email().max(254) }).safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: "Enter a valid email address." });
    // Account lookup and email delivery start only AFTER the identical response is
    // flushed. Neither an absent account nor a slow/failing relay affects timing.
    // Bound work in memory; clients can retry after overload or process restart.
    res.once("finish", () => {
      if (pending >= 50) return;
      pending++;
      void requestRecovery(parsed.data.email.trim().toLowerCase(), deliver)
        .catch(() => console.warn("[recovery]", { reason: "request_failed" }))
        .finally(() => {
          pending--;
        });
    });
    res.status(202).json(recoveryConfirmation);
  });
  router.use(limiter(10));
  router.post(
    "/status",
    asyncHandler(async (req, res) => {
      const parsed = z.object({ token: recoveryToken }).safeParse(req.body);
      const state = parsed.success
        ? await recoveryStatus(parsed.data.token)
        : "invalid";
      res.json({ success: true, data: { state } });
    })
  );
  router.post(
    "/consume",
    asyncHandler(async (req, res) => {
      const parsed = z
        .object({ token: recoveryToken, password: recoveryPassword })
        .safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Use a valid link and a password of at least 12 characters and at most 72 UTF-8 bytes.",
          });
      const state = await consumeRecovery(
        parsed.data.token,
        parsed.data.password
      );
      if (state === "complete") clearAuthCookie(res);
      res
        .status(state === "complete" ? 200 : 400)
        .json({ success: state === "complete", data: { state } });
    })
  );
  return router;
}
