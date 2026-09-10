import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingContainer } from '../LoadingContainer/LoadingContainer';
import { clearImpersonationTarget } from '../../utils/impersonation';
import { markSessionActive, clearSessionMarker, hasSessionMarker, AUTH_SESSION_STORAGE_KEY } from '../../utils/authSession';

type LoginModalContextValue = {
  openLogin: () => void;
  closeLogin: () => void;
  prefetchLoginModal: () => void;
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  loginWithCredentials: (username: string, password: string, rememberMe: boolean) => Promise<void>;
  /**
   * Drops a fully-formed session (user) straight into state without hitting
   * /api/auth/login — used by the invite-accept flow, whose
   * POST /api/invites/:token/accept response is shaped identically to a
   * login response (same JWT-signing code path server-side) so the new user
   * lands signed in immediately instead of being bounced to a login step.
   * The token itself is never part of this — both endpoints set it as an
   * httpOnly cookie (issue #53), never in the response body.
   */
  completeSession: (session: { user: User }) => void;
  user: User | null;
  logout: () => void;
  /** False until the mount-time /me rehydration has settled (or immediately true when there's no session marker). */
  authReady: boolean;
};

export interface User {
  id: string;
  username: string;
  nickname?: string | null;
  email?: string;
  role: 'user' | 'admin' | 'moderator';
  createdAt: string;
  updatedAt: string;
}

interface LoginResponse {
  success: boolean;
  data: {
    user: User;
    expiresAt: string;
  };
  error?: string;
}

const LoginModalContext = createContext<LoginModalContextValue | undefined>(undefined);

// Lazy-load the modal component
type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  sessionExpired?: boolean;
  savedUsername?: string;
  rememberMe?: boolean;
  onSubmit?: (username: string, password: string, rememberMe: boolean) => void | Promise<void>;
};

let LoginModalLazy: React.LazyExoticComponent<React.ComponentType<LoginModalProps>> | null = null;

function ensureModalImported() {
  if (!LoginModalLazy) {
    LoginModalLazy = lazy(() => import('./LoginModal'));
  }
}

export const LoginModalProvider = ({ children }: React.PropsWithChildren<{}>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const returnToRef = useRef<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [savedUsername, setSavedUsername] = useState(() => localStorage.getItem('rememberedUsername') ?? '');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('rememberedUsername'));
  const navigate = useNavigate();

  const BASE_URL = import.meta.env.VITE_BASEURL || "http://localhost:8081"

  // Re-validates `user` against whatever token is currently in localStorage —
  // shared by the mount-time rehydration below and the cross-tab storage
  // listener further down, so both paths treat the backend's /me response as
  // the single source of truth for "who am I" instead of trusting a token's
  // embedded claims or a previous render's state.
  //
  // The token itself is an httpOnly cookie now (issue #53) — unreadable by
  // this code, sent automatically by the browser via `credentials:
  // 'include'`. There is nothing left to pass in; a call either succeeds
  // (valid cookie) or 401s (missing/invalid/expired).
  const rehydrateSession = useCallback((): Promise<void> => {
    return fetch(`${BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then((res) => {
        if (res.ok) return res.json();
        // No/invalid/expired cookie — clean up silently (no expiry modal on boot)
        clearSessionMarker();
        setSessionExpired(false);
        return null;
      })
      .then((data) => setUser(data?.data ?? null))
      .catch(() => {
        clearSessionMarker();
        setUser(null);
      });
  }, [BASE_URL]);

  // On mount, rehydrate user from an existing session cookie. Gated on the
  // local "did we last think we were logged in" marker rather than always
  // firing — an anonymous visitor shouldn't pay for a network round trip
  // just to be told "no session" every single page load.
  useEffect(() => {
    if (!hasSessionMarker() || user) {
      setAuthReady(true);
      return;
    }
    rehydrateSession().finally(() => setAuthReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-tab account switch (bug report, prod incident): the previous
  // version of this comment described `authToken` living in localStorage,
  // shared across every tab/window on the same origin, with each tab's
  // React `user` state as its own in-memory copy set once at login/mount
  // and never re-checked. That gap is now structural in the other
  // direction too — the token is an httpOnly cookie (issue #53), which the
  // browser also shares across every tab, but which fires NO `storage`
  // event when it changes (cookies never do). So `authSession` (see
  // utils/authSession.ts) exists specifically to keep firing that signal:
  // every login/logout bumps it, and every open tab listens for the bump
  // and re-validates `user` (and drops any impersonation override, which is
  // real-admin-gated and must not survive an account change) against the
  // backend's /me response — the same "ask the server, don't trust local
  // state" fix as before, just keyed off a marker instead of the token
  // value itself.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== AUTH_SESSION_STORAGE_KEY) return;
      clearImpersonationTarget();
      if (e.newValue === null) {
        setUser(null);
        return;
      }
      rehydrateSession();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [rehydrateSession]);

  const openLogin = useCallback(() => {
    ensureModalImported();
    setSessionExpired(false);
    setIsOpen(true);
  }, []);

  // Listen for token expiry events dispatched by fetchWithAuth (production only)
  useEffect(() => {
    const handleExpired = (e: Event) => {
      if (import.meta.env.DEV) return;

      const path = (e as CustomEvent<{ returnTo: string }>).detail?.returnTo ?? null;
      clearSessionMarker();
      clearImpersonationTarget();
      setUser(null);
      returnToRef.current = path;
      setSessionExpired(true);
      ensureModalImported();
      setIsOpen(true);
      navigate('/');
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [navigate]);

  // Listen for a stale-role 403 dispatched by fetchWithAuth (#45). The
  // session cookie is still valid here, only the cached role is wrong, so
  // this re-asks /me instead of logging the user out — a demoted admin
  // loses their stale "admin" state the moment the backend actually
  // disagrees with it, rather than on the next full page load.
  useEffect(() => {
    const handleRoleStale = () => {
      rehydrateSession();
    };

    window.addEventListener('auth:role-stale', handleRoleStale);
    return () => window.removeEventListener('auth:role-stale', handleRoleStale);
  }, [rehydrateSession]);

  const closeLogin = useCallback(() => {
    setIsOpen(false);
    setErrorMessage(null);
    setSessionExpired(false);
  }, []);

  const prefetchLoginModal = useCallback(() => {
    ensureModalImported();
  }, []);

  const loginWithCredentials = useCallback(async (username: string, password: string, rememberMe: boolean) => {
    if (rememberMe) {
      localStorage.setItem('rememberedUsername', username);
      setSavedUsername(username);
      setRememberMe(true);
    } else {
      localStorage.removeItem('rememberedUsername');
      setSavedUsername('');
      setRememberMe(false);
    }

    setErrorMessage(null);
    if (!username || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }

      // The backend set the token as an httpOnly cookie (issue #53) — this
      // marker is the cross-tab signal only, never the token itself.
      markSessionActive();
      setUser(data.data.user);
      setIsOpen(false);
      setSessionExpired(false);

      console.log(`Welcome ${data.data.user.username}`)

      // Navigate back to the page they were on when their token expired
      if (returnToRef.current) {
        navigate(returnToRef.current);
        returnToRef.current = null;
      }

      window.dispatchEvent(new CustomEvent('auth:login', { detail: data.data }));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate]);

  const completeSession = useCallback((session: { user: User }) => {
    // The accept-invite response already set the cookie server-side
    // (issue #53) — this marker is the cross-tab signal only.
    markSessionActive();
    setUser(session.user);
    setIsOpen(false);
    setSessionExpired(false);
    setErrorMessage(null);

    window.dispatchEvent(new CustomEvent('auth:login', { detail: session }));
  }, []);

  const logout = useCallback(() => {
    // Override survives a refresh but never a logout (TEAM-BRIEF.md Track C
    // item 1) — clear it before the auth state flips so no further request
    // can go out carrying a stale X-Impersonate-User-Id.
    clearImpersonationTarget();
    clearSessionMarker();
    setUser(null);

    // The token is an httpOnly cookie now (issue #53) — this tab can't drop
    // it itself, so logout has to ask the backend to clear it. Best-effort:
    // local state has already flipped by the time this resolves, and a
    // failed request here just leaves a cookie that still expires on its
    // own JWT_EXPIRES_IN schedule, same exposure window as before this
    // change.
    fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});

    // Trigger global auth state update
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }, [BASE_URL]);

  const value = useMemo(
    () => ({
      openLogin,
      closeLogin,
      prefetchLoginModal,
      isOpen,
      isSubmitting,
      errorMessage,
      loginWithCredentials,
      completeSession,
      user,
      logout,
      authReady,
    }),
    [
      openLogin,
      closeLogin,
      prefetchLoginModal,
      isOpen,
      isSubmitting,
      errorMessage,
      loginWithCredentials,
      completeSession,
      user,
      logout,
      authReady,
    ],
  );

  const Modal = LoginModalLazy;

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      {isOpen && Modal && (
        <Suspense fallback={<LoadingContainer loading={true} width={250} height={250} />}>
          <Modal
            open={isOpen}
            onClose={closeLogin}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            sessionExpired={sessionExpired}
            savedUsername={savedUsername}
            rememberMe={rememberMe}
            onSubmit={loginWithCredentials}
          />
        </Suspense>
      )}
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => {
  const ctx = useContext(LoginModalContext);
  if (!ctx) {
    throw new Error('useLoginModal must be used within a LoginModalProvider');
  }
  return ctx;
};
