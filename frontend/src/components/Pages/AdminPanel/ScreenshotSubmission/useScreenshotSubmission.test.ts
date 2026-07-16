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

// TEAM-BRIEF.md Sprint 13, Track B item 2: the tile picker is now
// Drops-only — KC/XP tiles auto-verify from the hiscores and never go
// through screenshot review, so offering them here would let an admin
// "approve" a tile the backend can't actually attach a submission to.
describe('useScreenshotSubmission — Drops-only tile picker (TEAM-BRIEF.md Sprint 13)', () => {
  const boardRow = (id: string, type: 'Kill Count' | 'Experience' | 'Drops') => ({
    id,
    task: `Task ${id}`,
    type,
    points: 10,
  });

  it('offers only Drops-type tiles in tileOptions, even when KC/XP tiles also have ids', async () => {
    installRouter({
      '/bingo/board': jsonResponse(200, {
        data: [
          boardRow('kc-1', 'Kill Count'),
          boardRow('xp-1', 'Experience'),
          boardRow('drop-1', 'Drops'),
          boardRow('drop-2', 'Drops'),
        ],
      }),
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tileOptions.map((t) => t.id).sort()).toEqual(['drop-1', 'drop-2']);
    expect(result.current.boardMissingTileIds).toBe(false);
    expect(result.current.boardHasNoDropsTiles).toBe(false);
  });

  it('flags boardHasNoDropsTiles (distinct from boardMissingTileIds) when the board has id-carrying tiles but none are Drops', async () => {
    installRouter({
      '/bingo/board': jsonResponse(200, {
        data: [boardRow('kc-1', 'Kill Count'), boardRow('xp-1', 'Experience')],
      }),
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tileOptions).toEqual([]);
    expect(result.current.boardHasNoDropsTiles).toBe(true);
    expect(result.current.boardMissingTileIds).toBe(false);
  });

  it('still flags the genuine boardMissingTileIds error when tiles have no id at all', async () => {
    installRouter({
      '/bingo/board': jsonResponse(200, {
        data: [{ task: 'No id', type: 'Drops', points: 10 }],
      }),
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.boardMissingTileIds).toBe(true);
    expect(result.current.boardHasNoDropsTiles).toBe(false);
  });
});

// TEAM-BRIEF.md Sprint 13, Track A item 4 / Track B item 2 (frozen
// contract): approving now requires a playerId — the backend 422s without
// one. This proves the hook always sends whatever playerId is selected
// (including none) rather than silently omitting it the way the old
// optional-attribution flow did.
describe('useScreenshotSubmission — approve requires player (TEAM-BRIEF.md Sprint 13)', () => {
  it('sends playerId in the approve request body when one is selected', async () => {
    let approveBody: unknown = null;
    installRouter({
      '/bingo/screenshots/pending': jsonResponse(200, {
        data: [
          { id: 'sub-1', imageUrl: null, submittedBy: 'Discord', submittedAt: '2026-07-08T00:00:00.000Z' },
        ],
      }),
      '/bingo/screenshots/sub-1/approve': () => {
        return jsonResponse(200, { success: true, data: { id: 'sub-1' } });
      },
    });
    // Capture the approve request body directly, since installRouter's
    // simple suffix-matching doesn't expose per-call request options.
    const originalImpl = mockedFetchWithAuth.getMockImplementation();
    mockedFetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/bingo/screenshots/sub-1/approve') && init?.body) {
        approveBody = JSON.parse(init.body as string);
      }
      return originalImpl!(url, init);
    });

    const { result } = renderHook(() => useScreenshotSubmission());
    await vi.waitFor(() => expect(result.current.pending.length).toBe(1));

    act(() => result.current.setTileForSubmission('sub-1', 'tile-1'));
    act(() => result.current.setTeamForSubmission('sub-1', 'team-1'));
    act(() => result.current.setPlayerForSubmission('sub-1', 'player-1'));
    await act(async () => {
      await result.current.approve('sub-1');
    });

    expect(approveBody).toEqual({ tileId: 'tile-1', teamId: 'team-1', playerId: 'player-1' });
    expect(result.current.pending).toEqual([]);
  });
});
