import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useBingoBoard } from './useBingoBoard';

// fetchWithAuth mocked so this hook's fetch/parse logic is tested without a
// network round trip (same convention as useBingoOverview.test.ts and
// useTeamDrafter.test.ts).
vi.mock('../../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Issue #49: pendingByMyTeam was only exercised indirectly through
// BingoTile's props in BingoTile.test.tsx, never against the hook that
// actually parses the /bingo/board response. This asserts the wire field
// survives the hook unchanged, for both states a tile can carry it in.
describe('useBingoBoard pendingByMyTeam wiring (issue #49)', () => {
  it('passes pendingByMyTeam: true through for a tile awaiting review', async () => {
    mockedFetchWithAuth.mockResolvedValue(
      jsonResponse({
        active: true,
        bingo: { id: 'bingo-1', name: 'Test Bingo', boardSize: 25 },
        myTeam: { id: 'team-1', name: 'Team One' },
        tiles: [
          {
            id: 'tile-1',
            task: 'Get a drop',
            completedByMyTeam: false,
            pendingByMyTeam: true,
            type: 'Drops',
            points: 5,
            targetValue: null,
          },
        ],
      }),
    );

    const { result } = renderHook(() => useBingoBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.board?.active).toBe(true);
    if (result.current.board?.active) {
      expect(result.current.board.tiles[0].pendingByMyTeam).toBe(true);
      expect(result.current.board.tiles[0].completedByMyTeam).toBe(false);
    }
  });

  it('passes pendingByMyTeam: false through for a tile with no pending submission', async () => {
    mockedFetchWithAuth.mockResolvedValue(
      jsonResponse({
        active: true,
        bingo: { id: 'bingo-1', name: 'Test Bingo', boardSize: 25 },
        myTeam: { id: 'team-1', name: 'Team One' },
        tiles: [
          {
            id: 'tile-2',
            task: 'Kill 100 goblins',
            completedByMyTeam: true,
            pendingByMyTeam: false,
            type: 'Kill Count',
            points: 3,
            targetValue: 100,
          },
        ],
      }),
    );

    const { result } = renderHook(() => useBingoBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    if (result.current.board?.active) {
      expect(result.current.board.tiles[0].pendingByMyTeam).toBe(false);
    } else {
      throw new Error('expected an active board state');
    }
  });

  it('surfaces a fetch failure as an error and clears the board', async () => {
    mockedFetchWithAuth.mockResolvedValue(jsonResponse({ error: 'nope' }, 500));

    const { result } = renderHook(() => useBingoBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.board).toBeNull();
    expect(result.current.error).toMatch(/failed to load the bingo board/i);
  });

  it('refetch re-requests /bingo/board and applies the new response', async () => {
    mockedFetchWithAuth.mockImplementation(async () => jsonResponse({ active: false }));

    const { result } = renderHook(() => useBingoBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedFetchWithAuth).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockedFetchWithAuth).toHaveBeenCalledTimes(2);
    expect(result.current.board).toEqual({ active: false });
  });
});
