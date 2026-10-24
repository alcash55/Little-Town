import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect, authorizeReal } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { rateLimitKey } from "../middleware/rateLimitKey.js";
import { getRequestToken } from "../lib/session.js";
import { LOCAL_DEV_USER_ID } from "../middleware/auth.js";
import { issueRecovery } from "../services/accountRecovery.js";
import { findUserByUsername, listUsers } from "../db/users.js";

// GET /api/admin/users -> { users: [{ id, label, role }] } — the
// impersonation-target picker (TEAM-BRIEF.md Sprint 6, Track A item 2).
//
// Mounted as its own router (rather than folded into admin.ts, which gates
// everything on `authorize("admin", "moderator")` evaluated against the
// possibly-impersonated req.user) so it can use `authorizeReal("admin")`
// instead — this is "the impersonation grant itself" per the brief's
// security note, so it must keep working for an admin who is CURRENTLY
// impersonating someone else (their req.user is temporarily a non-admin).
export const adminUsersRoutes = Router();

adminUsersRoutes.use(protect);

adminUsersRoutes.get(
  "/",
  authorizeReal("admin"),
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await listUsers();
    res.status(200).json({ users });
  })
);

// Only an intentional request by the real signed-in admin may reveal a link.
adminUsersRoutes.post(
  "/recovery",
  authorizeReal("admin"),
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: rateLimitKey,
    message: { success: false, error: "Too many recovery links. Try again in 15 minutes." } }),
  asyncHandler(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!getRequestToken(req) || req.realUser?.id === LOCAL_DEV_USER_ID) {
      return res.status(403).json({ success: false, error: "Sign in as an admin to issue recovery links." });
    }
    const input = z.object({ username: z.string().trim().min(1).max(100), confirm: z.literal(true) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, error: "Confirm the account username." });
    const user = await findUserByUsername(input.data.username);
    if (!user) return res.status(404).json({ success: false, error: "Account not found." });
    if (user.email) return res.status(400).json({ success: false, error: "This account has an email. Use email recovery." });
    const url = await issueRecovery(user.id);
    console.info("[recovery]", { action: "admin_link_issued", adminId: req.realUser?.id, userId: user.id });
    res.json({ success: true, data: { url, expiresInMinutes: 60 } });
  }),
);
