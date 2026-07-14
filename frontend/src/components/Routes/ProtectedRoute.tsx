import { Navigate, useLocation } from 'react-router-dom';
import { useLoginModal } from '../LoginModal/useLoginModal';
import { LoadingContainer } from '../LoadingContainer/LoadingContainer';
import { useEffectiveRole } from '../../utils/useEffectiveRole';

type Role = 'admin' | 'user' | 'moderator';

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles: Role[];
}

/**
 * Wraps a route and redirects to /unauthorized if the current user
 * does not have one of the required roles. Unauthenticated users are
 * redirected to /unauthorized so the login modal can be triggered.
 *
 * Gating uses the EFFECTIVE role (utils/useEffectiveRole.ts) — the session
 * role, unless a real admin has an active impersonation override, in which
 * case the target's role applies instead (TEAM-BRIEF.md Sprint 10, Track C
 * item 1). This is what makes an admin viewing-as a plain user land on
 * /unauthorized for an admin-only route instead of the shell rendering
 * behind API calls that 403.
 *
 * In development (bun dev), all routes are accessible without auth.
 */
export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  // Bypass auth entirely in local dev
  if (import.meta.env.DEV) {
    return children;
  }

  const { user, authReady } = useLoginModal();
  const { role: effectiveRole } = useEffectiveRole();
  const location = useLocation();

  // Wait for the mount-time /me rehydration to settle before deciding whether
  // to redirect — otherwise a hard refresh briefly bounces logged-in users to
  // /unauthorized while the token is still being verified.
  if (!authReady) {
    return <LoadingContainer loading width={250} height={250} />;
  }

  if (!user) {
    return <Navigate to="/unauthorized" state={{ from: location, reason: 'unauthenticated' }} replace />;
  }

  if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/unauthorized" state={{ from: location, reason: 'forbidden' }} replace />;
  }

  return children;
};
