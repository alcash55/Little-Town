import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useBingoLifecycle, type LifecycleBingo } from './useBingoLifecycle';

// Every request goes through fetchWithAuth — mocked so these tests never
// touch the network (same convention as useBingoDetails.test.ts /
// useRsnConfirmation.test.ts).
vi.mock('../../../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const ACTIVE: LifecycleBingo = { id: 'bingo-1', name: 'Summer Bingo', status: 'active' };
const DRAFT: LifecycleBingo = { id: 'bingo-2', name: 'Autumn Bingo', status: 'draft' };

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useBingoLifecycle — End Early', () => {
  it('posts to /bingo/:id/end and surfaces pendingScreenshots on success', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          id: ACTIVE.id,
          status: 'complete',
          endedAt: '2026-08-03T00:00:00.000Z',
          pendingScreenshots: 3,
        },
      }),
    );
    const onChanged = vi.fn();
    const { result } = renderHook(() => useBingoLifecycle(ACTIVE, onChanged));

    let closable: boolean | undefined;
    await act(async () => {
      closable = await result.current.endEarly();
    });

    expect(closable).toBe(true);
    expect(result.current.endResult).toEqual({
      name: ACTIVE.name,
      endedAt: '2026-08-03T00:00:00.000Z',
      pendingScreenshots: 3,
    });
    expect(result.current.endError).toBeNull();
    // The mirrored bingo flips to complete in place — Clone still needs its
    // id afterward, so it must not be nulled out.
    expect(result.current.bingo).toEqual({ ...ACTIVE, status: 'complete' });

    const [url, init] = mockedFetchWithAuth.mock.calls[0];
    expect(url).toContain(`/bingo/${ACTIVE.id}/end`);
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('treats a 409 "not active" as information (dialog-closable), not an error', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(409, { success: false, error: 'Bingo is not active' }),
    );
    const { result } = renderHook(() => useBingoLifecycle(ACTIVE, vi.fn()));

    let closable: boolean | undefined;
    await act(async () => {
      closable = await result.current.endEarly();
    });

    expect(closable).toBe(true);
    expect(result.current.endInfo).toBe('Bingo is not active (HTTP 409)');
    expect(result.current.endResult).toBeNull();
    expect(result.current.endError).toBeNull();
  });

  it('surfaces a real failure as endError and reports the dialog should stay open', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(500, { success: false, error: 'Database unavailable' }),
    );
    const { result } = renderHook(() => useBingoLifecycle(ACTIVE, vi.fn()));

    let closable: boolean | undefined;
    await act(async () => {
      closable = await result.current.endEarly();
    });

    expect(closable).toBe(false);
    expect(result.current.endError).toBe('Database unavailable (HTTP 500)');
  });
});

describe('useBingoLifecycle — Delete', () => {
  it('sends BOTH force:true and the typed X-Confirm-Delete header, reports purged counts, clears the mirror, and calls onChanged', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          deleted: true,
          id: ACTIVE.id,
          purged: { teams: 2, tiles: 25, players: 14, submissions: 8, storageObjects: 8 },
        },
      }),
    );
    const onChanged = vi.fn();
    const { result } = renderHook(() => useBingoLifecycle(ACTIVE, onChanged));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteBingo('Summer Bingo');
    });

    expect(ok).toBe(true);
    expect(result.current.deleteResult).toEqual({
      teams: 2,
      tiles: 25,
      players: 14,
      submissions: 8,
      storageObjects: 8,
    });
    expect(result.current.bingo).toBeNull();
    expect(onChanged).toHaveBeenCalledTimes(1);

    const [url, init] = mockedFetchWithAuth.mock.calls[0];
    expect(url).toContain(`/bingo/${ACTIVE.id}`);
    expect(init).toMatchObject({
      method: 'DELETE',
      headers: { 'X-Confirm-Delete': 'Summer Bingo' },
      body: JSON.stringify({ force: true }),
    });
  });

  it('sends whatever text was typed verbatim as the header, even a mismatch — the caller (dialog) is what gates on an exact match, not this hook', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(409, { error: 'Refusing to delete an active bingo', code: 'BINGO_ACTIVE' }),
    );
    const { result } = renderHook(() => useBingoLifecycle(ACTIVE, vi.fn()));

    await act(async () => {
      await result.current.deleteBingo('wrong name');
    });

    const [, init] = mockedFetchWithAuth.mock.calls[0];
    expect(init).toMatchObject({ headers: { 'X-Confirm-Delete': 'wrong name' } });
    expect(result.current.deleteError).toBe('Refusing to delete an active bingo (HTTP 409)');
    // A failed delete must not clear the mirror or fire onChanged — nothing
    // actually changed server-side.
    expect(result.current.bingo).toEqual(ACTIVE);
  });

  it('does not clear the mirror or call onChanged on a real failure, and reports not-closable', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(jsonResponse(500, { error: 'Database unavailable' }));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useBingoLifecycle(ACTIVE, onChanged));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteBingo('Summer Bingo');
    });

    expect(ok).toBe(false);
    expect(result.current.bingo).toEqual(ACTIVE);
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('useBingoLifecycle — Clone', () => {
  it('posts sourceBingoId + the typed fields, reports tilesCloned, and calls onChanged so the page picks up the new draft', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(201, {
        success: true,
        data: { id: 'bingo-3', name: 'Winter Bingo', status: 'draft', tilesCloned: 16 },
      }),
    );
    const onChanged = vi.fn();
    const { result } = renderHook(() => useBingoLifecycle(DRAFT, onChanged));

    let closable: boolean | undefined;
    await act(async () => {
      closable = await result.current.cloneBingo({
        name: 'Winter Bingo',
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
      });
    });

    expect(closable).toBe(true);
    expect(result.current.cloneResult).toEqual({
      id: 'bingo-3',
      name: 'Winter Bingo',
      tilesCloned: 16,
    });
    expect(onChanged).toHaveBeenCalledTimes(1);

    const [url, init] = mockedFetchWithAuth.mock.calls[0];
    expect(url).toContain('/bingo/clone');
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        sourceBingoId: DRAFT.id,
        name: 'Winter Bingo',
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
      }),
    });
  });

  it('flags a 409 "active bingo already exists" as a conflict, not a raw error, and is dialog-closable', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(409, { error: 'An active bingo already exists', code: 'BINGO_ACTIVE' }),
    );
    const { result } = renderHook(() => useBingoLifecycle(DRAFT, vi.fn()));

    let closable: boolean | undefined;
    await act(async () => {
      closable = await result.current.cloneBingo({ name: 'X', startDate: 'a', endDate: 'b' });
    });

    expect(closable).toBe(true);
    expect(result.current.cloneConflict).toBe(true);
    expect(result.current.cloneError).toBeNull();
  });

  it('surfaces a 404 "source bingo not found" as a real error, not-closable', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(404, { error: 'Source bingo not found', code: 'BINGO_NOT_FOUND' }),
    );
    const { result } = renderHook(() => useBingoLifecycle(DRAFT, vi.fn()));

    let closable: boolean | undefined;
    await act(async () => {
      closable = await result.current.cloneBingo({ name: 'X', startDate: 'a', endDate: 'b' });
    });

    expect(closable).toBe(false);
    expect(result.current.cloneError).toBe('Source bingo not found (HTTP 404)');
    expect(result.current.cloneConflict).toBe(false);
  });
});

describe('useBingoLifecycle — source mirroring', () => {
  it('picks up a new source bingo id (e.g. the page loaded a different draft)', async () => {
    const { result, rerender } = renderHook(({ source }) => useBingoLifecycle(source, vi.fn()), {
      initialProps: { source: ACTIVE as LifecycleBingo | null },
    });
    expect(result.current.bingo).toEqual(ACTIVE);

    rerender({ source: DRAFT });
    await waitFor(() => expect(result.current.bingo).toEqual(DRAFT));
  });

  it('ignores the parent going to null after a mirror is already set (End Early keeps its own local copy)', async () => {
    const { result, rerender } = renderHook(({ source }) => useBingoLifecycle(source, vi.fn()), {
      initialProps: { source: ACTIVE as LifecycleBingo | null },
    });
    expect(result.current.bingo).toEqual(ACTIVE);

    rerender({ source: null });
    expect(result.current.bingo).toEqual(ACTIVE);
  });

  // Regression coverage for a bug caught in browser verification: chaining
  // End Early -> Clone -> Delete in one session (a real Alex workflow — end
  // this round, spin up the next draft from its board, then clean up the
  // round the moment it's superseded) left the End Early success alert
  // reading `Ended "" early.` once the mirror moved past it, because that
  // alert used to read the bingo's name live off the mirror instead of the
  // name captured at the moment it actually ended.
  it('keeps endResult.name pointing at the ended bingo even after a later action changes/clears the mirror', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          id: ACTIVE.id,
          status: 'complete',
          endedAt: '2026-08-03T00:00:00.000Z',
          pendingScreenshots: 0,
        },
      }),
    );
    const { result } = renderHook(() => useBingoLifecycle(ACTIVE, vi.fn()));

    await act(async () => {
      await result.current.endEarly();
    });
    expect(result.current.endResult?.name).toBe(ACTIVE.name);

    // Clone succeeds (mirror unaffected by this call) then Delete clears it.
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(201, {
        success: true,
        data: { id: 'bingo-9', name: 'Next Round', status: 'draft', tilesCloned: 1 },
      }),
    );
    await act(async () => {
      await result.current.cloneBingo({ name: 'Next Round', startDate: 'a', endDate: 'b' });
    });

    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          deleted: true,
          id: 'bingo-9',
          purged: { teams: 0, tiles: 1, players: 0, submissions: 0, storageObjects: 0 },
        },
      }),
    );
    await act(async () => {
      await result.current.deleteBingo('Next Round');
    });

    expect(result.current.bingo).toBeNull();
    // The already-shown End Early message must not have changed.
    expect(result.current.endResult?.name).toBe(ACTIVE.name);
  });
});
