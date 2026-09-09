/**
 * A non-sensitive "am I logged in" marker, kept in localStorage purely so
 * every open tab can notice when another tab logs in or out.
 *
 * The auth token itself lives only in an httpOnly cookie now (issue #53) —
 * deliberately unreadable by JS, which is the whole point (an XSS payload
 * or a compromised dependency can no longer read it via
 * `localStorage.getItem`). But that also means a tab can't inspect
 * `localStorage` to learn that ANOTHER tab just logged in/out the way the
 * old `authToken` value did — cookies don't fire the `storage` event, and
 * this app already has a real prod incident (see useLoginModal.tsx) where a
 * stale tab kept rendering as the wrong account after a different tab
 * switched users. This marker exists to keep that cross-tab sync working
 * without putting the token back in a place JS can read.
 *
 * The value is a timestamp, not a boolean, so writing it always changes the
 * stored value (and therefore always fires `storage` in other tabs) even
 * when going from one logged-in account straight to a different one —
 * `localStorage.setItem(key, sameValue)` does not fire `storage` at all.
 */
const STORAGE_KEY = 'authSession';

export const AUTH_SESSION_STORAGE_KEY = STORAGE_KEY;

export function markSessionActive(): void {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

export function clearSessionMarker(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasSessionMarker(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
