import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginModalProvider, useLoginModal } from './useLoginModal';
import { setImpersonationTarget } from '../../utils/impersonation';
import { AUTH_SESSION_STORAGE_KEY } from '../../utils/authSession';

const ADMIN_USER = { id: 'admin-1', username: 'QaAdminTest', role: 'admin', createdAt: '', updatedAt: '' };
const PLAIN_USER = { id: 'user-1', username: 'GuySmoocherTest', role: 'user', createdAt: '', updatedAt: '' };

// The real session lives in an httpOnly cookie the browser attaches
// automatically (issue #53) — nothing this test can read or set directly.
// Stand-in for "whichever user the backend's cookie currently resolves to",
// so GET /api/auth/me's mock below can answer the way the real endpoint
// would once its cookie changes, without this test needing a real cookie
// jar.
let currentServerSession: typeof ADMIN_USER | typeof PLAIN_USER | null = null;

const mockMeEndpoint = () =>
  vi.fn(async (url: string) => {
    if (!String(url).includes('/api/auth/me')) return new Response(null, { status: 404 });
    if (currentServerSession) {
      return new Response(JSON.stringify({ success: true, data: currentServerSession }), { status: 200 });
    }
    return new Response(null, { status: 401 });
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <LoginModalProvider>{children}</LoginModalProvider>
  </MemoryRouter>
);

/**
 * Simulates what a DIFFERENT tab does on login/logout: changes which user
 * the (shared, cookie-based) session resolves to, then bumps the
 * `authSession` localStorage marker the way markSessionActive()/
 * clearSessionMarker() do, and fires the `storage` event this tab's
 * listener reacts to — real browsers fire `storage` in every other
 * same-origin tab the instant one tab's write commits (never in the tab
 * that made it); happy-dom doesn't do this automatically for same-document
 * writes, so it's dispatched by hand here, same as the old token-based
 * version of this test did.
 */
const dispatchAuthSessionChange = (serverUser: typeof ADMIN_USER | typeof PLAIN_USER | null) => {
  currentServerSession = serverUser;
  const oldValue = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (serverUser === null) {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } else {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, String(Date.now() + Math.random()));
  }
  const newValue = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SESSION_STORAGE_KEY, oldValue, newValue }));
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  currentServerSession = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Regression coverage for the prod incident: a tab left open on an
// admin-only page kept its React `user` state (and therefore
// ProtectedRoute/useSidebar's effective-role decision) frozen at whatever it
// was on mount, even after a DIFFERENT tab in the same browser logged out
// and back in as a different account. See useLoginModal.tsx's `storage`
// listener and utils/authSession.ts for why this is keyed off a
// non-sensitive marker rather than the token itself now.
describe('LoginModalProvider — cross-tab account switch (bug-report investigation, prod incident)', () => {
  it("re-validates `user` against the backend when another tab's session changes (admin -> plain user)", async () => {
    currentServerSession = ADMIN_USER;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, '1');
    vi.stubGlobal('fetch', mockMeEndpoint());

    const { result } = renderHook(() => useLoginModal(), { wrapper });

    await waitFor(() => expect(result.current.authReady).toBe(true));
    expect(result.current.user?.role).toBe('admin');

    act(() => {
      dispatchAuthSessionChange(PLAIN_USER);
    });

    await waitFor(() => expect(result.current.user?.role).toBe('user'));
    expect(result.current.user?.username).toBe('GuySmoocherTest');
  });

  it('re-validates in the other direction too (plain user -> admin)', async () => {
    currentServerSession = PLAIN_USER;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, '1');
    vi.stubGlobal('fetch', mockMeEndpoint());

    const { result } = renderHook(() => useLoginModal(), { wrapper });
    await waitFor(() => expect(result.current.user?.role).toBe('user'));

    act(() => {
      dispatchAuthSessionChange(ADMIN_USER);
    });

    await waitFor(() => expect(result.current.user?.role).toBe('admin'));
  });

  it('drops any active impersonation override once another tab changes the session', async () => {
    currentServerSession = ADMIN_USER;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, '1');
    setImpersonationTarget({ id: 'target-1', label: 'Someone', role: 'user' });
    vi.stubGlobal('fetch', mockMeEndpoint());

    const { result } = renderHook(() => useLoginModal(), { wrapper });
    await waitFor(() => expect(result.current.user?.role).toBe('admin'));
    expect(sessionStorage.getItem('impersonation:target')).not.toBeNull();

    act(() => {
      dispatchAuthSessionChange(PLAIN_USER);
    });

    await waitFor(() => expect(result.current.user?.role).toBe('user'));
    expect(sessionStorage.getItem('impersonation:target')).toBeNull();
  });

  it('logs this tab out when another tab logs out (authSession marker cleared)', async () => {
    currentServerSession = ADMIN_USER;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, '1');
    vi.stubGlobal('fetch', mockMeEndpoint());

    const { result } = renderHook(() => useLoginModal(), { wrapper });
    await waitFor(() => expect(result.current.user?.role).toBe('admin'));

    act(() => {
      dispatchAuthSessionChange(null);
    });

    await waitFor(() => expect(result.current.user).toBeNull());
  });

  it('ignores storage events for unrelated keys', async () => {
    currentServerSession = ADMIN_USER;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, '1');
    const fetchMock = mockMeEndpoint();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useLoginModal(), { wrapper });
    await waitFor(() => expect(result.current.user?.role).toBe('admin'));

    const callsBefore = fetchMock.mock.calls.length;
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'rememberedUsername', oldValue: null, newValue: 'x' }),
      );
    });

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    expect(result.current.user?.role).toBe('admin');
  });
});

describe('LoginModalProvider — mount without a prior session', () => {
  it('does not call /api/auth/me when there is no authSession marker (anonymous visitor)', async () => {
    const fetchMock = mockMeEndpoint();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useLoginModal(), { wrapper });

    await waitFor(() => expect(result.current.authReady).toBe(true));
    expect(result.current.user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
