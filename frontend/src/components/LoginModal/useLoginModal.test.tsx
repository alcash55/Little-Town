import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginModalProvider, useLoginModal } from './useLoginModal';
import { setImpersonationTarget } from '../../utils/impersonation';

const ADMIN_TOKEN = 'admin-token';
const USER_TOKEN = 'user-token';

const ADMIN_USER = { id: 'admin-1', username: 'QaAdminTest', role: 'admin', createdAt: '', updatedAt: '' };
const PLAIN_USER = { id: 'user-1', username: 'GuySmoocherTest', role: 'user', createdAt: '', updatedAt: '' };

const mockMeEndpoint = () =>
  vi.fn(async (_url: string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined;
    const auth = headers?.Authorization;
    if (auth === `Bearer ${ADMIN_TOKEN}`) {
      return new Response(JSON.stringify({ success: true, data: ADMIN_USER }), { status: 200 });
    }
    if (auth === `Bearer ${USER_TOKEN}`) {
      return new Response(JSON.stringify({ success: true, data: PLAIN_USER }), { status: 200 });
    }
    return new Response(null, { status: 401 });
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <LoginModalProvider>{children}</LoginModalProvider>
  </MemoryRouter>
);

const dispatchAuthTokenChange = (oldValue: string | null, newValue: string | null) => {
  if (newValue === null) localStorage.removeItem('authToken');
  else localStorage.setItem('authToken', newValue);
  window.dispatchEvent(new StorageEvent('storage', { key: 'authToken', oldValue, newValue }));
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Regression coverage for the prod incident: a tab left open on an
// admin-only page kept its React `user` state (and therefore
// ProtectedRoute/useSidebar's effective-role decision) frozen at whatever it
// was on mount, even after a DIFFERENT tab in the same browser logged out
// and back in as a different account — because `authToken` lives in
// localStorage, which is shared across tabs, but nothing previously told
// this tab to re-check it. See useLoginModal.tsx's `storage` listener.
describe('LoginModalProvider — cross-tab account switch (bug-report investigation, prod incident)', () => {
  it("re-validates `user` against the backend when another tab rotates the shared token (admin -> plain user)", async () => {
    localStorage.setItem('authToken', ADMIN_TOKEN);
    vi.stubGlobal('fetch', mockMeEndpoint());

    const { result } = renderHook(() => useLoginModal(), { wrapper });

    await waitFor(() => expect(result.current.authReady).toBe(true));
    expect(result.current.user?.role).toBe('admin');

    // Simulate the OTHER tab's login: it writes the new token to shared
    // storage. Real browsers fire `storage` in every other same-origin tab
    // the instant that write commits (never in the tab that made it) — we
    // dispatch it by hand here since happy-dom doesn't do this automatically
    // for same-document writes.
    act(() => {
      dispatchAuthTokenChange(ADMIN_TOKEN, USER_TOKEN);
    });

    await waitFor(() => expect(result.current.user?.role).toBe('user'));
    expect(result.current.user?.username).toBe('GuySmoocherTest');
  });

  it('re-validates in the other direction too (plain user -> admin)', async () => {
    localStorage.setItem('authToken', USER_TOKEN);
    vi.stubGlobal('fetch', mockMeEndpoint());

    const { result } = renderHook(() => useLoginModal(), { wrapper });
    await waitFor(() => expect(result.current.user?.role).toBe('user'));

    act(() => {
      dispatchAuthTokenChange(USER_TOKEN, ADMIN_TOKEN);
    });

    await waitFor(() => expect(result.current.user?.role).toBe('admin'));
  });

  it('drops any active impersonation override once the shared token rotates to a different account', async () => {
    localStorage.setItem('authToken', ADMIN_TOKEN);
    setImpersonationTarget({ id: 'target-1', label: 'Someone', role: 'user' });
    vi.stubGlobal('fetch', mockMeEndpoint());

    const { result } = renderHook(() => useLoginModal(), { wrapper });
    await waitFor(() => expect(result.current.user?.role).toBe('admin'));
    expect(sessionStorage.getItem('impersonation:target')).not.toBeNull();

    act(() => {
      dispatchAuthTokenChange(ADMIN_TOKEN, USER_TOKEN);
    });

    await waitFor(() => expect(result.current.user?.role).toBe('user'));
    expect(sessionStorage.getItem('impersonation:target')).toBeNull();
  });

  it('logs this tab out when another tab logs out (authToken removed from shared storage)', async () => {
    localStorage.setItem('authToken', ADMIN_TOKEN);
    vi.stubGlobal('fetch', mockMeEndpoint());

    const { result } = renderHook(() => useLoginModal(), { wrapper });
    await waitFor(() => expect(result.current.user?.role).toBe('admin'));

    act(() => {
      dispatchAuthTokenChange(ADMIN_TOKEN, null);
    });

    await waitFor(() => expect(result.current.user).toBeNull());
  });

  it('ignores storage events for unrelated keys', async () => {
    localStorage.setItem('authToken', ADMIN_TOKEN);
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
