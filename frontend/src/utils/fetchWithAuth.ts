import { getImpersonationTarget } from './impersonation';

/**
 * A wrapper around fetch that automatically handles 401 responses.
 * When a 401 is detected, it dispatches an 'auth:expired' event which
 * the LoginModalProvider listens to in order to log the user out and
 * redirect them to the home page, storing their current location so
 * they can be returned to it after re-login.
 *
 * Also the single place `X-Impersonate-User-Id` gets attached (see
 * utils/impersonation.ts) — every caller that goes through fetchWithAuth
 * picks up an active admin "view as user" override automatically, with no
 * per-call wiring required.
 */
export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = localStorage.getItem('authToken');
  const impersonationTarget = getImpersonationTarget();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(impersonationTarget && { 'X-Impersonate-User-Id': impersonationTarget.id }),
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, { ...options, headers });

  // Only treat 401 as a session expiry when we actually sent a stored token.
  // Unauthenticated 401s (e.g. dev without login) must not open the expiry modal.
  // In local dev, ProtectedRoute already bypasses auth — skip the modal entirely.
  if (response.status === 401 && token) {
    localStorage.removeItem('authToken');
    if (!import.meta.env.DEV) {
      window.dispatchEvent(
        new CustomEvent('auth:expired', {
          detail: { returnTo: window.location.pathname },
        })
      );
    }
  }

  return response;
};
