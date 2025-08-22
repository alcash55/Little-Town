import { createContext, useCallback, useContext, useMemo, useState, lazy, Suspense } from 'react';
import { LoadingContainer } from '../LoadingContainer/LoadingContainer';

type LoginModalContextValue = {
  openLogin: () => void;
  closeLogin: () => void;
  prefetchLoginModal: () => void;
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  user: User | null;
  logout: () => void;
};

interface User {
  id: string;
  username: string;
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

// Lazy-load the modal component for code splitting
type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit?: (username: string, password: string) => void | Promise<void>;
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

  const openLogin = useCallback(() => {
    ensureModalImported();
    setIsOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setIsOpen(false);
    setErrorMessage(null);
  }, []);

  const prefetchLoginModal = useCallback(() => {
    ensureModalImported();
  }, []);

  const loginWithCredentials = useCallback(async (username: string, password: string) => {
    setErrorMessage(null);
    if (!username || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('http://localhost:8081/api/auth/login', {
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

      // You might want to trigger a global auth state update here
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
