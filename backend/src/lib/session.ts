/**
 * Auth cookie + JWT session helpers shared by /api/auth/login and
 * /api/invites/:token/accept (both sign a JWT the same way and hand the
 * caller a live session — see routes/auth.ts and routes/invites.ts).
 *
 * The token itself is never returned in a JSON response body anymore
 * (issue #53) — it travels only as an httpOnly cookie the browser attaches
 * automatically, so a script running on the page (XSS, a compromised
 * dependency, a browser extension) cannot read it via
 * `localStorage.getItem`/`document.cookie`. This app has an admin
 * impersonation feature, so a stolen token is a stolen "act as anyone"
 * capability, not just one account — see the issue for the full blast-radius
 * argument.
 *
 * `parse`/`serialize` come from the `cookie` package, already a transitive
 * dependency of express — declared directly in package.json rather than
 * relied on transitively, since a future express bump is free to drop it.
 */
import { parse, serialize } from "cookie";
import jwt, { SignOptions } from "jsonwebtoken";
import { Request, Response } from "express";
import { getJwtSecret } from "./jwt.js";
import { User } from "../types/index.js";

export const AUTH_COOKIE_NAME = "authToken";

/** Opt in only after Render verifies the custom domain. Keep legacy cookies working. */
export function getSameSiteAuthHost(): string | undefined {
  const host = process.env.AUTH_SAME_SITE_HOST;
  if (!host) return undefined;
  if (host !== "api.littletown.gay") {
    throw new Error("AUTH_SAME_SITE_HOST must be api.littletown.gay or unset");
  }
  return host;
}

function cookieOptions(req: Request) {
  const isProd = process.env.NODE_ENV === "production";
  // Use the actual Host, not X-Forwarded-Host from a client. Neither hostname
  // nor cookie policy grants authentication; protect still verifies the JWT.
  const sameSiteHost = getSameSiteAuthHost();
  const isSameSiteHost =
    sameSiteHost !== undefined &&
    req.get("host")?.toLowerCase() === sameSiteHost;
  const sameSite: "none" | "lax" = isProd && !isSameSiteHost ? "none" : "lax";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite,
    // No Domain attribute: each host keeps its own session during cutover.
    path: "/",
  };
}

export function signSession(user: Pick<User, "id" | "username" | "role" | "sessionVersion">): {
  token: string;
  expiresAt: string;
} {
  const expiresIn = (process.env.JWT_EXPIRES_IN ||
    "24h") as SignOptions["expiresIn"];
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, sessionVersion: user.sessionVersion ?? 0 },
    getJwtSecret(),
    { expiresIn }
  );

  // Read the actual `exp` claim back off the token so expiresAt always
  // matches what was signed, regardless of JWT_EXPIRES_IN's format.
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return { token, expiresAt };
}

export function setAuthCookie(res: Response, token: string): void {
  res.setHeader(
    "Set-Cookie",
    serialize(AUTH_COOKIE_NAME, token, cookieOptions(res.req))
  );
}

export function clearAuthCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    serialize(AUTH_COOKIE_NAME, "", { ...cookieOptions(res.req), maxAge: 0 })
  );
}

/**
 * Resolves the bearer token for a request: the httpOnly cookie first (the
 * browser/frontend path), falling back to an `Authorization: Bearer` header
 * (non-browser API clients, scripts, and the existing test harness's
 * `signTestToken`/`jsonRequest({ token })` — see tests/integration/helpers.ts —
 * keep working unchanged). Used by `protect`/`optionalAuth` and by
 * `rateLimitKey`, which must key on the same identity `protect` will land on.
 */
export function getRequestToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    const fromCookie = cookies[AUTH_COOKIE_NAME];
    if (fromCookie) return fromCookie;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return undefined;
}
