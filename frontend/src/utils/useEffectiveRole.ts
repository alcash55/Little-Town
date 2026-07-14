import { useMemo } from 'react';
import { useLoginModal } from '../components/LoginModal/useLoginModal';
import { useImpersonationTarget } from '../components/AppShell/InternalComponent/Impersonation/useImpersonationTarget';

export type EffectiveRole = 'user' | 'admin' | 'moderator';

export interface EffectiveRoleInfo {
  /**
   * The role route gating (ProtectedRoute) and the sidebar (useSidebar)
   * should treat the current visitor as. `null` when nobody is logged in.
   */
  role: EffectiveRole | null;
  /** True while a real admin has an active "view as" override. */
  isImpersonating: boolean;
}

/**
 * Single source of truth for "what role should this render as" (TEAM-BRIEF.md
 * Sprint 10, Track C item 1). An active impersonation override replaces the
 * session's own role with the target's — captured on the `ImpersonationTarget`
 * at activation time (see utils/impersonation.ts) from the same
 * `GET /api/admin/users` payload the picker already uses.
 *
 * The override only applies for a REAL admin — mirrors the defensive check
 * in ImpersonationBannerHost (a non-admin should never have a target to
 * begin with; this is belt-and-suspenders against a stale/cross-user
 * sessionStorage value briefly being read before that cleanup effect runs).
 *
 * ProtectedRoute and useSidebar both call this instead of reading
 * `user.role` directly, so route gating and the sidebar can never disagree
 * about who the app is currently being viewed as.
 */
export const useEffectiveRole = (): EffectiveRoleInfo => {
  const { user } = useLoginModal();
  const { target } = useImpersonationTarget();

  return useMemo(() => {
    const isRealAdmin = user?.role === 'admin';
    if (isRealAdmin && target) {
      return { role: target.role, isImpersonating: true };
    }
    return { role: user?.role ?? null, isImpersonating: false };
  }, [user, target]);
};
