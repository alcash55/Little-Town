import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { LOCAL_DEV_USER_ID, protect, authorize } from "../middleware/auth.js";
import { validateBody, inviteCreateSchema, inviteAcceptSchema } from "../lib/validation.js";
import {
  createInvite,
  listInvites,
  revokeInvite,
  validateInviteToken,
  acceptInvite,
  InviteRole,
} from "../db/invites.js";
import jwt, { SignOptions } from "jsonwebtoken";
import { getJwtSecret } from "../lib/jwt.js";
import { ApiResponse, LoginResponse } from "../types/index.js";

const getAuditUserId = (req: Request): string | undefined =>
  req.user?.id === LOCAL_DEV_USER_ID ? undefined : req.user?.id;

// -------------------------------------------------------
// Admin-facing invite management — mounted at /api/admin/invites.
// Frozen contract, TEAM-BRIEF.md Track A item 1.
// -------------------------------------------------------

export const adminInviteRoutes = Router();

adminInviteRoutes.use(protect);
adminInviteRoutes.use(authorize("admin"));

// POST /api/admin/invites  { role?, expiresInHours? } -> { id, url, role, expiresAt, createdAt }
adminInviteRoutes.post(
  "/",
  validateBody(inviteCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { role, expiresInHours } = req.body as { role?: InviteRole; expiresInHours?: number };
    const invite = await createInvite({ role, expiresInHours, createdBy: getAuditUserId(req) });
    res.status(201).json(invite);
  }),
);

// GET /api/admin/invites -> { invites: [...] }
adminInviteRoutes.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const invites = await listInvites();
    res.status(200).json({ invites });
  }),
);

// DELETE /api/admin/invites/:id -> revoke
adminInviteRoutes.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ success: false, error: "Invite ID is required" });

    await revokeInvite(id);
    res.status(200).json({ success: true, message: "Invite revoked" });
  }),
);

// -------------------------------------------------------
// Public invite lookup + accept — mounted at /api/invites. No auth: these
// ARE the pre-auth onboarding flow. Rate-limited at the app level in
// index.ts (same treatment as /api/auth/login) since a raw token is the
// entire access control here.
// -------------------------------------------------------

export const publicInviteRoutes = Router();

// GET /api/invites/:token -> { valid, reason?, role? }
publicInviteRoutes.get(
  "/:token",
  asyncHandler(async (req: Request, res: Response) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    if (!token) return res.status(400).json({ success: false, error: "Token is required" });

    const result = await validateInviteToken(token);
    res.status(200).json(result);
  }),
);

// POST /api/invites/:token/accept  { username, password, nickname? }
//
// Accept/registration flow (auth-dependent — this app has no Supabase Auth
// and no self-registration endpoint today, see the Track A report). Creates
// the `users` row under the invite's granted role and burns the invite
// atomically (accept_invite RPC), then signs a JWT the same way
// POST /api/auth/login does so the new user lands logged in immediately
// instead of being bounced to a separate login step.
publicInviteRoutes.post(
  "/:token/accept",
  validateBody(inviteAcceptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    if (!token) return res.status(400).json({ success: false, error: "Token is required" });

    const { username, password, nickname } = req.body as {
      username: string;
      password: string;
      nickname?: string;
    };

    const user = await acceptInvite(token, { username, password, nickname });

    const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"];
    const jwtToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      getJwtSecret(),
      { expiresIn },
    );
    const decoded = jwt.decode(jwtToken) as { exp?: number } | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: { user, token: jwtToken, expiresAt },
    };
    res.status(201).json(response);
  }),
);
