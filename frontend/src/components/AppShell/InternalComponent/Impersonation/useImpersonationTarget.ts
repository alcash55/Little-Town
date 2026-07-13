import { useCallback, useEffect, useState } from 'react';
import {
  IMPERSONATION_CHANGE_EVENT,
  ImpersonationTarget,
  clearImpersonationTarget,
  getImpersonationTarget,
  setImpersonationTarget,
} from '../../../../utils/impersonation';

/**
 * Shared read/write access to the active impersonation override — used by
 * both the app-bar picker (ImpersonationControl) and the banner
 * (ImpersonationBanner). Activating or clearing does a full page reload so
 * every already-mounted page's data refetches under the new
 * X-Impersonate-User-Id state (this app has no central data-fetching layer
 * to invalidate piecemeal); the `impersonation:change` event keeps any
 * other mounted listeners in sync even without a reload (e.g. the
 * defensive non-admin cleanup in ImpersonationBannerHost).
 */
export const useImpersonationTarget = () => {
  const [target, setTarget] = useState<ImpersonationTarget | null>(() => getImpersonationTarget());

  useEffect(() => {
    const handleChange = (e: Event) => {
      setTarget((e as CustomEvent<ImpersonationTarget | null>).detail ?? null);
    };
    window.addEventListener(IMPERSONATION_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(IMPERSONATION_CHANGE_EVENT, handleChange);
  }, []);

  const activate = useCallback((next: ImpersonationTarget) => {
    setImpersonationTarget(next);
    window.location.reload();
  }, []);

  const clear = useCallback(() => {
    clearImpersonationTarget();
    window.location.reload();
  }, []);

  return { target, activate, clear };
};
