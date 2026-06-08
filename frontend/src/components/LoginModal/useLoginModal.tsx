import { createContext, useCallback, useContext, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingContainer } from '../LoadingContainer/LoadingContainer';

type LoginModalContextValue = {
  openLogin: () => void;
  closeLogin: () => void;
  prefetchLoginModal: () => void;
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  loginWithCredentials: (username: string, password: string, rememberMe: boolean) => Promise<void>;
  user: User | null;
  logout: () => void;
};

interface User {
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
    token: string;
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
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [savedUsername, setSavedUsername] = useState(() => localStorage.getItem('rememberedUsername') ?? '');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('rememberedUsername'));
  const navigate = useNavigate();

  const BASE_URL = import.meta.env.VITE_BASEURL || "http://localhost:8081"

  // On mount, rehydrate user from existing token
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token || user) return;

    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        // Token is invalid or expired — clean up silently (no expiry modal on boot)
        localStorage.removeItem('authToken');
        setSessionExpired(false);
        return null;
      })
      .then((data) => {
        if (data?.data) setUser(data.data);
      })
      .catch(() => localStorage.removeItem('authToken'));
  }, []);

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
      localStorage.removeItem('authToken');
      setUser(null);
      setReturnTo(path);
      setSessionExpired(true);
      ensureModalImported();
      setIsOpen(true);
      navigate('/');
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [navigate]);

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
        body: JSON.stringify({ username, password }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      localStorage.setItem('authToken', data.data.token);
      setUser(data.data.user);
      setIsOpen(false);
      setSessionExpired(false);

      console.log(`Welcome ${data.data.user.username}`)

      // Navigate back to the page they were on when their token expired
      if (returnTo) {
        navigate(returnTo);
        setReturnTo(null);
      }

      window.dispatchEvent(new CustomEvent('auth:login', { detail: data.data }));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    setUser(null);

    // Trigger global auth state update
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }, []);

  const value = useMemo(
    () => ({
      openLogin,
      closeLogin,
      prefetchLoginModal,
      isOpen,
      isSubmitting,
      errorMessage,
      loginWithCredentials,
      user,
      logout,
    }),
    [
      openLogin,
      closeLogin,
      prefetchLoginModal,
      isOpen,
      isSubmitting,
      errorMessage,
      loginWithCredentials,
      user,
      logout,
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
