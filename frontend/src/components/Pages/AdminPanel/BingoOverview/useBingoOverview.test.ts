import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBingoOverview } from './useBingoOverview';

// The hook goes through fetchWithAuth for every request — mocked here so
// these tests never touch the network and can assert on exactly which
// endpoints get hit on each 45s poll tick (TEAM-BRIEF.md contract 6).
vi.mock('../../../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

/**
 * Routes every fetchWithAuth call by matching the URL's path suffix, so the
 * mock doesn't have to care about call ORDER (Promise.all fires several of
 * these concurrently every tick).
 */
function installRouter(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    '/bingo/details': { data: { id: 'bingo-1', name: 'Test Bingo', status: 'active', teamObjects: [] } },
    '/bingo/players': { data: [] },
    '/bingo/board': { data: [] },
    '/bingo/player-stats': { data: [] },
    '/bingo/team-stats': { data: [] },
    '/bingo/screenshots/pending': { data: [] },
    '/health/dependencies': { services: [] },
    '/bingo-1/conflicts': { conflicts: [] },
    ...overrides,
  };

  mockedFetchWithAuth.mockImplementation(async (url: string) => {
    const match = Object.entries(defaults).find(([suffix]) => url.includes(suffix));
    if (!match) return jsonResponse({ data: [] });
    return jsonResponse(match[1]);
  });
}

/** Count of calls whose URL matches `pathSuffix` since the last reset. */
const callCountFor = (pathSuffix: string) =>
  mockedFetchWithAuth.mock.calls.filter(([url]) => (url as string).includes(pathSuffix)).length;

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useBingoOverview polling (TEAM-BRIEF.md contract 6)', () => {
  it('fetches player-stats on initial mount', async () => {
    installRouter();
    renderHook(() => useBingoOverview());

    await vi.waitFor(() => expect(callCountFor('/bingo/player-stats')).toBeGreaterThan(0));
  });

  // Regression test: fetchPlayerStats was missing from the 45s poll tick's
  // Promise.all (bug-report investigation, H1 follow-up on Alex's "still
  // broken" report) — every OTHER card on the page (pending screenshots,
  // dependency health, conflicts, team-stats) refreshed automatically every
  // 45s, but Player Stats silently sat on whatever it fetched at mount,
  // even after an admin backfilled attribution elsewhere and came back to
  // an already-open tab. This proves the poll tick now includes it.
  it('re-fetches player-stats on every 45s poll tick, not just at mount', async () => {
    installRouter();
    renderHook(() => useBingoOverview());

    await vi.waitFor(() => expect(callCountFor('/bingo/player-stats')).toBeGreaterThan(0));
    const afterMount = callCountFor('/bingo/player-stats');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });

    expect(callCountFor('/bingo/player-stats')).toBeGreaterThan(afterMount);
  });

  it('keeps polling team-stats too (pre-existing behavior, not regressed by the fix above)', async () => {
    installRouter();
    renderHook(() => useBingoOverview());

    await vi.waitFor(() => expect(callCountFor('/bingo/team-stats')).toBeGreaterThan(0));
    const afterMount = callCountFor('/bingo/team-stats');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });

    expect(callCountFor('/bingo/team-stats')).toBeGreaterThan(afterMount);
  });

  it('does not poll while the tab is hidden', async () => {
    installRouter();
    renderHook(() => useBingoOverview());
    await vi.waitFor(() => expect(callCountFor('/bingo/player-stats')).toBeGreaterThan(0));
    const afterMount = callCountFor('/bingo/player-stats');

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });

    expect(callCountFor('/bingo/player-stats')).toBe(afterMount);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
});

describe('useBingoOverview KPI totals — attribution-gap fallback', () => {
  it('surfaces unattributedTiles from team-stats so the BingoOverview banner can render', async () => {
    installRouter({
      '/bingo/team-stats': {
        data: [
          { teamId: 't1', teamName: 'Team 1', tilesCompleted: 1, totalPoints: 20, unattributedTiles: 0, unattributedPoints: 0 },
          { teamId: 't2', teamName: 'Team 2', tilesCompleted: 1, totalPoints: 20, unattributedTiles: 1, unattributedPoints: 20 },
          { teamId: 't3', teamName: 'Team 3', tilesCompleted: 1, totalPoints: 20, unattributedTiles: 1, unattributedPoints: 20 },
        ],
      },
    });

    const { result } = renderHook(() => useBingoOverview());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.teamStats.reduce((sum, t) => sum + t.unattributedTiles, 0)).toBe(2);
  });
});

// TEAM-BRIEF.md Sprint 13, Track A item 1 (frozen contract) / Track B item
// 3: team-stats additionally returns `unresolvableTiles` — trackable-type
// tiles the completion engine couldn't map to a hiscore metric (Track A has
// shipped this server-side — see backend/src/routes/admin.ts's team-stats
// handler and services/completionEngine.ts). These tests fake the
// fetchWithAuth response shape (standard mock-the-network-layer pattern
// used throughout this file) to exercise the hook's parsing/fallback logic
// in isolation.
describe('useBingoOverview — unresolvable tiles warning (TEAM-BRIEF.md Sprint 13)', () => {
  it('surfaces unresolvableTiles from team-stats', async () => {
    installRouter({
      '/bingo/team-stats': {
        data: [],
        unresolvableTiles: [
          { id: 'tile-9', task: 'Kill the big boss thing', type: 'Kill Count' },
        ],
      },
    });

    const { result } = renderHook(() => useBingoOverview());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unresolvableTiles).toEqual([
      { id: 'tile-9', task: 'Kill the big boss thing', type: 'Kill Count' },
    ]);
  });

  it('defaults to an empty list when the field is absent (today\'s pre-Track-A backend)', async () => {
    installRouter({
      '/bingo/team-stats': { data: [] },
    });

    const { result } = renderHook(() => useBingoOverview());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unresolvableTiles).toEqual([]);
  });

  it('resets to empty when team-stats fails to load, rather than keeping a stale list', async () => {
    installRouter();
    // installRouter's suffix-router always returns 200 — override just
    // team-stats here to a real failing Response for this one test.
    mockedFetchWithAuth.mockImplementation(async (url: string) => {
      if (url.includes('/bingo/team-stats')) return new Response('boom', { status: 500 });
      return jsonResponse({ data: [] });
    });

    const { result } = renderHook(() => useBingoOverview());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unresolvableTiles).toEqual([]);
  });
});
