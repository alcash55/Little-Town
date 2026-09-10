import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithAuth } from './fetchWithAuth';
import { markSessionActive, clearSessionMarker } from './authSession';
import { clearImpersonationTarget, setImpersonationTarget } from './impersonation';

const mockResponse = (status: number) => Promise.resolve(new Response(null, { status }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearImpersonationTarget();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchWithAuth — 403 stale-role guard (#45)', () => {
  it('dispatches auth:role-stale on a 403 when a session marker is present', async () => {
    markSessionActive();
    vi.stubGlobal('fetch', vi.fn(() => mockResponse(403)));
    const listener = vi.fn();
    window.addEventListener('auth:role-stale', listener);

    await fetchWithAuth('/api/admin/whatever');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:role-stale', listener);
  });

  it('does not dispatch on a 403 with no session marker (never claimed a role to begin with)', async () => {
    clearSessionMarker();
    vi.stubGlobal('fetch', vi.fn(() => mockResponse(403)));
    const listener = vi.fn();
    window.addEventListener('auth:role-stale', listener);

    await fetchWithAuth('/api/admin/whatever');

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('auth:role-stale', listener);
  });

  it('does not dispatch while impersonating (a 403 there is the intended outcome, not staleness)', async () => {
    markSessionActive();
    setImpersonationTarget({ id: 'target-1', label: 'Someone', role: 'user' });
    vi.stubGlobal('fetch', vi.fn(() => mockResponse(403)));
    const listener = vi.fn();
    window.addEventListener('auth:role-stale', listener);

    await fetchWithAuth('/api/admin/whatever');

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('auth:role-stale', listener);
  });

  it('does not dispatch on a 200', async () => {
    markSessionActive();
    vi.stubGlobal('fetch', vi.fn(() => mockResponse(200)));
    const listener = vi.fn();
    window.addEventListener('auth:role-stale', listener);

    await fetchWithAuth('/api/admin/whatever');

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('auth:role-stale', listener);
  });
});
