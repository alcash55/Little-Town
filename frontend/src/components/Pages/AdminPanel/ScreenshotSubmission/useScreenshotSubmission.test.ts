import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScreenshotSubmission } from './useScreenshotSubmission';

// Every request goes through fetchWithAuth — mocked so these tests never
// touch the network and can script exactly which contract response each
// endpoint returns (TEAM-BRIEF.md "Frozen contract").
vi.mock('../../../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const unattributedRow = (id: string, teamId: string) => ({
  id,
  tileId: 'tile-1',
  tileTask: 'Tile A',
  teamId,
  teamName: 'Team A',
  submittedBy: 'Discord',
  approvedAt: '2026-07-08T00:00:00.000Z',
  imageUrl: null,
});

function installRouter(overrides: Record<string, Response | (() => Response)> = {}) {
  const defaults: Record<string, unknown> = {
    '/bingo/screenshots/pending': { data: [] },
    '/bingo/screenshots/unattributed': { data: [] },
    '/bingo/details': { data: { teamObjects: [] } },
    '/bingo/board': { data: [] },
    '/bingo/players': { data: [] },
  };

  mockedFetchWithAuth.mockImplementation(async (url: string) => {
    const overrideMatch = Object.entries(overrides).find(([suffix]) => url.includes(suffix));
    if (overrideMatch) {
      const [, value] = overrideMatch;
      return typeof value === 'function' ? (value as () => Response)() : value;
    }
    const match = Object.entries(defaults).find(([suffix]) => url.includes(suffix));
    return jsonResponse(200, match ? match[1] : { data: [] });
  });
}

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useScreenshotSubmission — attribution worklist (bug-report investigation, H1)', () => {
  // Direct regression test for item 1 of the follow-up investigation: the
  // worklist must populate (and stay populated) regardless of whether there
  // are any PENDING submissions — ScreenshotSubmission.tsx renders it as a
  // sibling of the pending-queue's "All caught up" empty state, never nested
  // inside it. This proves the underlying data the component renders from
  // is correct even with zero pending submissions.
  it('populates unattributed submissions even when there are zero pending ones', async () => {
    installRouter({
      '/bingo/screenshots/pending': jsonResponse(200, { data: [] }),
      '/bingo/screenshots/unattributed': jsonResponse(200, {
        data: [unattributedRow('sub-1', 'team-b'), unattributedRow('sub-2', 'team-c')],
      }),
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pending).toEqual([]);
    expect(result.current.unattributed.map((s) => s.id)).toEqual(['sub-1', 'sub-2']);
  });

  // Regression test: a failed GET .../unattributed used to be swallowed
  // entirely (the section just silently showed nothing, indistinguishable
  // from "everything is attributed"). Now it surfaces a dismissible error.
  it('surfaces a visible error when the worklist fails to load, instead of silently showing nothing', async () => {
    installRouter({
      '/bingo/screenshots/unattributed': jsonResponse(500, { success: false, error: 'boom' }),
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unattributed).toEqual([]);
    expect(result.current.unattributedError).toMatch(/500/);

    act(() => result.current.dismissUnattributedError());
    expect(result.current.unattributedError).toBeNull();
  });

  it('clears the unattributed error on the next successful poll', async () => {
    let fail = true;
    installRouter({
      '/bingo/screenshots/unattributed': () =>
        fail
          ? jsonResponse(500, { success: false, error: 'boom' })
          : jsonResponse(200, { data: [unattributedRow('sub-1', 'team-b')] }),
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.unattributedError).not.toBeNull());

    fail = false;
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.unattributedError).toBeNull();
    expect(result.current.unattributed.map((s) => s.id)).toEqual(['sub-1']);
  });

  it('attribute() success removes the row from the worklist and clears its selection', async () => {
    installRouter({
      '/bingo/screenshots/unattributed': jsonResponse(200, {
        data: [unattributedRow('sub-1', 'team-b')],
      }),
      '/bingo/screenshots/sub-1/attribute': jsonResponse(200, {
        success: true,
        data: { id: 'sub-1', player_id: 'player-1' },
      }),
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.unattributed.length).toBe(1));

    act(() => result.current.setPlayerForAttribution('sub-1', 'player-1'));
    await act(async () => {
      await result.current.attribute('sub-1');
    });

    expect(result.current.unattributed).toEqual([]);
    expect(result.current.attributionError['sub-1']).toBeUndefined();
  });

  // The same-team validation error (validateApprovalPlayerId, contract 2)
  // must reach the UI verbatim, not get swallowed — mirrors the backend's
  // 400 `{ success: false, error }` shape exactly.
  it('attribute() failure (e.g. cross-team playerId 400) surfaces the backend error message visibly', async () => {
    installRouter({
      '/bingo/screenshots/unattributed': jsonResponse(200, {
        data: [unattributedRow('sub-1', 'team-b')],
      }),
      '/bingo/screenshots/sub-1/attribute': jsonResponse(400, {
        success: false,
        error: 'playerId must be a registered player on the given team',
      }),
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.unattributed.length).toBe(1));

    act(() => result.current.setPlayerForAttribution('sub-1', 'wrong-team-player'));
    await act(async () => {
      await result.current.attribute('sub-1');
    });

    // Row is NOT silently removed on failure, and the exact backend message
    // is preserved for the admin to see.
    expect(result.current.unattributed.map((s) => s.id)).toEqual(['sub-1']);
    expect(result.current.attributionError['sub-1']).toBe(
      'playerId must be a registered player on the given team',
    );
  });
});
