import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();

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
    const state: unknown = location.state;
    const from = state && typeof state === 'object' && 'from' in state ? state.from : null;
    const returnPath =
      location.pathname === '/unauthorized' &&
      from &&
      typeof from === 'object' &&
      'pathname' in from &&
      typeof from.pathname === 'string' &&
      from.pathname.startsWith('/') &&
      !from.pathname.startsWith('//')
        ? from.pathname
        : null;
    clearImpersonationTarget();
    // The role-change effect can replace history while reload is starting.
    // Reload the denied destination directly so that race cannot lose it.
    if (returnPath) window.location.replace(returnPath);
    else window.location.reload();
  }, [location]);

  return { target, activate, clear };
};
