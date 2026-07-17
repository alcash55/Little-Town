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
  // The board/details GETs are gated behind a stored auth token (same guard
  // as the real app — no token means "don't bother, fall back to any local
  // draft"); a logged-in admin session always has one.
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
