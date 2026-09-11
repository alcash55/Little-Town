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

/**
 * Frontend (GitHub Pages) and backend (Render) sit on different registrable
 * domains in production, which makes every authenticated request cross-site
 * for cookie purposes — SameSite=Lax/Strict cookies are never attached to a
 * cross-site fetch (Lax only rides along on a top-level GET navigation), so
 * production needs SameSite=None, which in turn requires Secure (HTTPS;
 * both Render and GitHub Pages already terminate TLS, so this holds).
 *
 * Local dev (localhost:3000 <-> localhost:8081) differs only by port, which
 * is the same registrable-domain "site" — Lax is enough there, and Secure
 * would break the cookie entirely since local dev is plain HTTP.
 *
 * NOTE (flagged for the lead, not fixed here): SameSite=None marks this as a
 * third-party cookie from the browser's point of view. Safari ITP, Firefox
 * strict tracking protection, and Chrome's own third-party-cookie
 * deprecation can all block or evict it independent of this code being
 * correct. The durable fix is putting the API under a subdomain of the
 * frontend's own registrable domain (api.<frontend-domain> instead of
 * *.onrender.com) so the cookie becomes first-party; that's an
 * infrastructure change outside this issue's scope.
 */
function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/",
  };
}

export function signSession(user: Pick<User, "id" | "username" | "role">): {
  token: string;
  expiresAt: string;
} {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"];
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    getJwtSecret(),
    { expiresIn },
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
  res.setHeader("Set-Cookie", serialize(AUTH_COOKIE_NAME, token, cookieOptions()));
}

export function clearAuthCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    serialize(AUTH_COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 }),
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
