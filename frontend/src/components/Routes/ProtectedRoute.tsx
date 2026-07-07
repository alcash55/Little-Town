import { Navigate, useLocation } from 'react-router-dom';
import { useLoginModal } from '../LoginModal/useLoginModal';
import { LoadingContainer } from '../LoadingContainer/LoadingContainer';

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
 * In development (bun dev), all routes are accessible without auth.
 */
export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  // Bypass auth entirely in local dev
  if (import.meta.env.DEV) {
    return children;
  }

  const { user, authReady } = useLoginModal();
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

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" state={{ from: location, reason: 'forbidden' }} replace />;
  }

  return children;
};
