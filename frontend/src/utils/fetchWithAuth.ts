import { getImpersonationTarget } from './impersonation';
import { hasSessionMarker, clearSessionMarker } from './authSession';

/**
 * A wrapper around fetch that automatically handles 401 responses.
 * When a 401 is detected, it dispatches an 'auth:expired' event which
 * the LoginModalProvider listens to in order to log the user out and
 * redirect them to the home page, storing their current location so
 * they can be returned to it after re-login.
 *
 * The auth token itself is an httpOnly cookie now (issue #53), so it's
 * attached by the browser automatically via `credentials: 'include'` —
 * there is no token for this function to read or send by hand.
 *
 * Also the single place `X-Impersonate-User-Id` gets attached (see
 * utils/impersonation.ts) — every caller that goes through fetchWithAuth
 * picks up an active admin "view as user" override automatically, with no
 * per-call wiring required.
 */
export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const impersonationTarget = getImpersonationTarget();
  // Read before the request goes out — if the response 401s, "did we think
  // we had a session" has to reflect the state at the time of the call, not
  // whatever clearSessionMarker() below may have just changed it to.
  const hadSession = hasSessionMarker();

  const headers = {
    'Content-Type': 'application/json',
    ...(impersonationTarget && { 'X-Impersonate-User-Id': impersonationTarget.id }),
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, { ...options, headers, credentials: 'include' });

  // Only treat 401 as a session expiry when we thought we had one.
  // Unauthenticated 401s (e.g. dev without login) must not open the expiry modal.
  // In local dev, ProtectedRoute already bypasses auth — skip the modal entirely.
  if (response.status === 401 && hadSession) {
    clearSessionMarker();
    if (!import.meta.env.DEV) {
      window.dispatchEvent(
        new CustomEvent('auth:expired', {
          detail: { returnTo: window.location.pathname },
        }),
      );
    }
  }

  return response;
};
