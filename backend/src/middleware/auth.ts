import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/jwt.js";
import { AppError } from "./errorHandler.js";
import { User } from "../types/index.js";
import { findUserById } from "../db/users.js";

export const LOCAL_DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

const localDevUser: User = {
  id: LOCAL_DEV_USER_ID,
  username: "local-dev-admin",
  nickname: "Local Dev Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      // The real, JWT-authenticated caller — set by `protect` alongside
      // `user`. Identical to `user` unless impersonation swapped `user` out
      // (see applyImpersonation below); always the caller who actually holds
      // the token, regardless of who they're impersonating.
      realUser?: User;
    }
  }
}

// -------------------------------------------------------
// Impersonation ("view as user" — TEAM-BRIEF.md Sprint 6, Track A item 2)
//
// When the REAL authenticated caller is an admin and sends the
// X-Impersonate-User-Id header, downstream authorization/data access
// (req.user, and therefore `authorize(...)`) behaves as the target user for
// the rest of the request — including being locked OUT of admin-only routes
// if the target isn't an admin, which is the point: an impersonating admin
// must otherwise see exactly what that user sees. `req.realUser` always
// keeps the actual caller so routes that manage the impersonation grant
// itself (GET /api/admin/users — see authorizeReal below) can still
// authorize correctly while an override is active.
//
// The grant is evaluated against the REAL caller (must be admin), never the
// already-impersonated user — an admin impersonating a plain user cannot use
// that user's request to pivot into impersonating someone else, since the
// swapped-in `req.user` is never what's checked here (`realUser` is,
// unconditionally, every call).
// -------------------------------------------------------

const IMPERSONATE_HEADER = "x-impersonate-user-id";

async function applyImpersonation(req: Request): Promise<void> {
  const realUser = req.user!;
  req.realUser = realUser;

  const headerValue = req.headers[IMPERSONATE_HEADER];
  const targetId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!targetId) return;

  // Non-admin callers get no impersonation power — the header is silently
  // ignored and the request proceeds as that caller's own request.
  if (realUser.role !== "admin") return;

  // Impersonating yourself is a harmless no-op (also covers the frontend
  // always sending the header once an override is picked, including back to
  // the admin's own id).
  if (targetId === realUser.id) return;

  const target = await findUserById(targetId);
  if (!target) {
    throw new AppError("Impersonation target not found", 400, "IMPERSONATION_TARGET_NOT_FOUND");
  }

  // Never allow impersonating another admin unless the caller IS that admin
  // (already handled above via the self-impersonation early return).
  if (target.role === "admin") {
    throw new AppError("Cannot impersonate another admin", 403, "IMPERSONATION_ADMIN_BLOCKED");
  }

  req.user = target;
  // Loud, structured, and on every impersonated request per the brief —
  // deliberately console.warn (not .log) so it's easy to grep/alert on.
  console.warn(
    `[impersonation] admin ${realUser.id} as ${target.id} ${req.method} ${req.originalUrl}`,
  );
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    if (
      process.env.ALLOW_DEV_AUTH === "true" &&
      process.env.NODE_ENV !== "production"
    ) {
      req.user = localDevUser;
      try {
        await applyImpersonation(req);
      } catch (error) {
        return next(error);
      }
      return next();
    }

    return next(new AppError("Not authorized to access this route", 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(
      token,
      getJwtSecret()
    ) as any;

    const user = await findUserById(decoded.id);

    if (!user) {
      return next(new AppError("Not authorized to access this route", 401));
    }

    req.user = user;
  } catch (error) {
    return next(new AppError("Not authorized to access this route", 401));
  }

  // Kept outside the jwt/lookup try/catch above so applyImpersonation's own
  // AppErrors (400/403) surface with their real status code instead of
  // being flattened into a generic 401 "Not authorized".
  try {
    await applyImpersonation(req);
  } catch (error) {
    return next(error);
  }

  next();
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("User not found", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }

    next();
  };
};

/**
 * Role guard that evaluates against the REAL authenticated caller
 * (req.realUser) rather than the possibly-impersonated req.user. Reserved
 * for the small set of admin-only endpoints that manage the impersonation
 * grant itself (today: GET /api/admin/users, the impersonation-target
 * picker) — those must stay usable by an admin who is currently
 * impersonating someone else, since dropping the override is a client-side
 * action (stop sending the header), not a server call. Every other
 * admin-only route should keep using `authorize`, so an impersonating admin
 * genuinely loses admin access for the duration of the override.
 */
export const authorizeReal = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const caller = req.realUser ?? req.user;
    if (!caller) {
      return next(new AppError("User not found", 401));
    }

    if (!roles.includes(caller.role)) {
      return next(
        new AppError(
          `User role ${caller.role} is not authorized to access this route`,
          403
        )
      );
    }

    next();
  };
};
