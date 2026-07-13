import { useEffect } from 'react';
import { useLoginModal } from '../../../LoginModal/useLoginModal';
import { clearImpersonationTarget } from '../../../../utils/impersonation';
import { useImpersonationTarget } from './useImpersonationTarget';
import { ImpersonationBanner } from './ImpersonationBanner';

/**
 * Mounted unconditionally in AppShell; renders nothing unless the real,
 * currently-authenticated caller is an admin AND an override is active —
 * "Non-admins never see any of it" (TEAM-BRIEF.md Track C item 1).
 *
 * Also a defensive cleanup: if a non-admin ends up with a stale
 * `sessionStorage` target (e.g. an admin's override left behind in the same
 * tab after a different, non-admin user logs in), it's cleared quietly
 * rather than surfaced — logout already clears it in the normal case (see
 * useLoginModal.tsx), this only covers the tab-reuse edge case. Gated on
 * `authReady`: right after a reload (activating/clearing forces one) `user`
 * is briefly null while the mount-time `/me` rehydration is in flight —
 * judging "not admin" from that transient state would wipe a target that
 * was just set.
 */
export const ImpersonationBannerHost = () => {
  const { user, authReady } = useLoginModal();
  const { target, clear } = useImpersonationTarget();
  const isRealAdmin = user?.role === 'admin';

  useEffect(() => {
    if (authReady && target && !isRealAdmin) {
      clearImpersonationTarget();
    }
  }, [authReady, target, isRealAdmin]);

  if (!target || !isRealAdmin) return null;

  return <ImpersonationBanner target={target} onClear={clear} />;
};
