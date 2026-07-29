import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBoardBuilder } from './useBoardBuilder';

// Every request goes through fetchWithAuth — mocked so these tests never
// touch the network (same convention as useScreenshotSubmission.test.ts /
// useBingoOverview.test.ts).
vi.mock('../../../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function installRouter(overrides: Record<string, Response> = {}) {
  const defaults: Record<string, Response> = {
    '/bingo/details': jsonResponse(200, { data: { boardSize: 16 } }),
    '/bingo/board': jsonResponse(200, { data: [] }),
    '/hiscores/activities/list': jsonResponse(200, []),
    '/hiscores/skills/list': jsonResponse(200, []),
  };

  mockedFetchWithAuth.mockImplementation(async (url: string) => {
    const overrideMatch = Object.entries(overrides).find(([suffix]) => url.includes(suffix));
    if (overrideMatch) return overrideMatch[1];
    const match = Object.entries(defaults).find(([suffix]) => url.includes(suffix));
    return match ? match[1] : jsonResponse(200, { data: [] });
  });
}

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
  localStorage.clear();
  // A logged-in admin session always has a token. The load is NO LONGER
  // gated on it, though — see the no-token regression test at the bottom of
  // this file for why that gate had to go.
  localStorage.setItem('authToken', 'test-admin-token');
  // The OSRS item-mapping fetch goes through raw `fetch` to an external
  // wiki API (cachedFetch), not fetchWithAuth — pre-seed its cache key so
  // these tests never attempt a real network call.
  sessionStorage.setItem('osrs:items', JSON.stringify([]));
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

// Direct regression coverage for the coordinator's follow-up: Board
// Builder's "A board already exists" warning depends on the same GETs that
// silently 403'd for a stale/cross-account session in the prod incident —
// this must surface as permissionDenied, never as "no board yet" (which
// looks safe to fill in and submit).
describe('useBoardBuilder — 403 -> permission-state mapping (bug-report investigation, prod incident)', () => {
  it('sets permissionDenied when the bingo-details GET 403s, without falling through to an empty builder', async () => {
    installRouter({ '/bingo/details': jsonResponse(403, { error: 'Forbidden' }) });

    const { result } = renderHook(() => useBoardBuilder());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(result.current.isExistingBoard).toBe(false);
    expect(result.current.loadError).toBeNull();
    // The board GET must never have been reached once permission was denied
    // on the first gating call — nothing to show alongside "no permission".
    expect(mockedFetchWithAuth).not.toHaveBeenCalledWith(expect.stringContaining('/bingo/board'));
  });

  it('sets permissionDenied when the board GET 403s even though bingo/details succeeded', async () => {
    installRouter({ '/bingo/board': jsonResponse(403, { error: 'Forbidden' }) });

    const { result } = renderHook(() => useBoardBuilder());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(result.current.isExistingBoard).toBe(false);
  });

  it('shows the "already exists" warning (isExistingBoard) for a genuine 200 with a saved board — not confused with permission-denied', async () => {
    installRouter({
      '/bingo/board': jsonResponse(200, {
        data: [{ type: 'Kill Count', task: 'Zulrah', points: 10, killCount: 5 }],
      }),
    });

    const { result } = renderHook(() => useBoardBuilder());

    await waitFor(() => expect(result.current.isExistingBoard).toBe(true));
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.board).toHaveLength(1);
  });

  it('leaves permissionDenied false for a genuine empty board (no board built yet)', async () => {
    installRouter();

    const { result } = renderHook(() => useBoardBuilder());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.isExistingBoard).toBe(false);
  });

  it('surfaces a real (non-permission) failure as loadError', async () => {
    installRouter({ '/bingo/details': jsonResponse(500, { error: 'Database unavailable' }) });

    const { result } = renderHook(() => useBoardBuilder());

    await waitFor(() => expect(result.current.loadError).toBe('Database unavailable (HTTP 500)'));
    expect(result.current.permissionDenied).toBe(false);
  });
});

describe('useBoardBuilder — error-message formatting on submit (bug-report investigation, prod incident)', () => {
  it('carries the HTTP status and server message when saving the board fails with a 403 and empty body', async () => {
    installRouter();
    const { result } = renderHook(() => useBoardBuilder());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedFetchWithAuth.mockResolvedValueOnce(new Response('', { status: 403, statusText: '' }));

    await result.current.submitBoard();

    await waitFor(() =>
      expect(result.current.submitError).toBe('Failed to save board (HTTP 403)'),
    );
    expect(result.current.submitError).not.toMatch(/:\s*$/);
  });
});

// Regression, 2026-07-28. The load used to be wrapped in `if (token)`, where
// token = localStorage 'authToken'. That silently broke the entire page under
// `bun dev`: ProtectedRoute bypasses auth in dev, and the backend's `protect`
// does the same for a missing token when ALLOW_DEV_AUTH=true, so an admin is
// routinely on this page with no token in localStorage. The gate skipped both
// GETs, fell through to the (empty) localStorage draft, and rendered an empty
// Board Builder with NO error — for a saved board that every other admin page
// displayed fine, because they all call fetchWithAuth unconditionally.
describe('useBoardBuilder — loads without a stored authToken (dev-auth bypass regression)', () => {
  const savedBoard = [
    { task: 'runecrafting', type: 'Experience', points: 1, experience: 1000000 },
    { task: 'zulrah', type: 'Kill Count', points: 1, killCount: 50 },
  ];

  it('still fetches the saved board when localStorage has no authToken', async () => {
    localStorage.removeItem('authToken');
    installRouter({ '/bingo/board': jsonResponse(200, { data: savedBoard }) });

    const { result } = renderHook(() => useBoardBuilder());

    await waitFor(() => expect(result.current.board).toHaveLength(2));
    // The saved board is what came back from the backend, and the page knows
    // it is editing an existing board (drives the "Update Board" affordance).
    expect(result.current.board).toEqual(savedBoard);
    expect(result.current.isExistingBoard).toBe(true);
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.loadError).toBeNull();
    // The requests must actually have gone out — the old gate's failure mode
    // was silence, not a bad response.
    expect(mockedFetchWithAuth).toHaveBeenCalledWith(expect.stringContaining('/bingo/board'));
    expect(mockedFetchWithAuth).toHaveBeenCalledWith(expect.stringContaining('/bingo/details'));
  });

  it('still maps a genuine 403 to permissionDenied when there is no token', async () => {
    // Removing the gate must not weaken the permission handling: an
    // unauthenticated caller against a backend WITHOUT the dev bypass gets a
    // real 403, and that must still surface as permission-denied.
    localStorage.removeItem('authToken');
    installRouter({ '/bingo/details': jsonResponse(403, { error: 'Forbidden' }) });

    const { result } = renderHook(() => useBoardBuilder());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(result.current.board).toHaveLength(0);
  });
});
