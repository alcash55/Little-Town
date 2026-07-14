/**
 * Admin "view as user" override (TEAM-BRIEF.md Sprint 6, Track A item 2 /
 * Track C item 1).
 *
 * The active target is persisted in `sessionStorage` — it survives a page
 * refresh but not a new tab/window or logout (LoginModalProvider.logout()
 * clears it explicitly). `fetchWithAuth` reads it directly, the same way it
 * already reads the auth token from `localStorage`, so every API call made
 * through the app's single fetch wrapper automatically carries
 * `X-Impersonate-User-Id` while an override is active — callers never wire
 * the header in per-call.
 *
 * `window.dispatchEvent` on change lets any number of mounted components
 * (the app-bar picker, the banner) stay in sync without prop-drilling or a
 * dedicated context provider, mirroring the existing `auth:*` event pattern
 * in useLoginModal.tsx / fetchWithAuth.ts.
 */

const STORAGE_KEY = 'impersonation:target';
export const IMPERSONATION_CHANGE_EVENT = 'impersonation:change';

export type ImpersonationRole = 'user' | 'admin' | 'moderator';

export interface ImpersonationTarget {
  id: string;
  label: string;
  /**
   * The target's role at the moment the override was activated (from the
   * `GET /api/admin/users` payload — TEAM-BRIEF.md Sprint 10, Track C item
   * 1). Drives the frontend's "effective role" for route gating and the
   * sidebar; see utils/useEffectiveRole.ts. A snapshot, not live — if the
   * target user's role changes (or they're deleted) after activation, the
   * override keeps using this cached value until the admin re-activates or
   * clears it.
   */
  role: ImpersonationRole;
}

const isImpersonationRole = (value: unknown): value is ImpersonationRole =>
  value === 'user' || value === 'admin' || value === 'moderator';

// Adding `role` above changes the persisted shape — this guard doubles as a
// migration: any pre-Sprint-10 target left in sessionStorage (id/label only,
// no role) now fails validation and is dropped by getImpersonationTarget()
// below instead of silently powering route/sidebar decisions with an
// `undefined` role.
const isImpersonationTarget = (value: unknown): value is ImpersonationTarget =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { id?: unknown }).id === 'string' &&
  typeof (value as { label?: unknown }).label === 'string' &&
  isImpersonationRole((value as { role?: unknown }).role);

export const getImpersonationTarget = (): ImpersonationTarget | null => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isImpersonationTarget(parsed)) return parsed;
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const setImpersonationTarget = (target: ImpersonationTarget | null): void => {
  if (target) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(
    new CustomEvent<ImpersonationTarget | null>(IMPERSONATION_CHANGE_EVENT, { detail: target }),
  );
};

export const clearImpersonationTarget = (): void => setImpersonationTarget(null);
