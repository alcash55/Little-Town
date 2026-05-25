import { Navigate, useLocation } from 'react-router-dom';
import { useLoginModal } from '../LoginModal/useLoginModal';

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

  const { user } = useLoginModal();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/unauthorized" state={{ from: location, reason: 'unauthenticated' }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" state={{ from: location, reason: 'forbidden' }} replace />;
  }

  return children;
};
