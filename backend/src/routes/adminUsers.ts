import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { protect, authorizeReal } from "../middleware/auth.js";
import { listUsers } from "../db/users.js";

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
  }),
);
