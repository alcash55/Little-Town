import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useBingoDetails } from './useBingoDetails';

// Every request goes through fetchWithAuth — mocked so these tests never
// touch the network (same convention as useScreenshotSubmission.test.ts /
// useBingoOverview.test.ts).
vi.mock('../../../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Direct regression coverage for the prod incident: a 403 on the mount-time
// "existing bingo" GET must surface as a permission-denied state, never as
// the same "isBingo: false" shape a genuine 200-with-no-bingo response
// produces — those two cases used to be indistinguishable to the page.
describe('useBingoDetails — 403 -> permission-state mapping (bug-report investigation, prod incident)', () => {
  it('sets permissionDenied and leaves isBingo false when the existing-bingo GET 403s', async () => {
    mockedFetchWithAuth.mockResolvedValue(
      jsonResponse(403, { error: 'User role user is not authorized to access this route' }),
    );

    const { result } = renderHook(() => useBingoDetails());

    await waitFor(() => expect(result.current.permissionDenied).toBe(true));
    expect(result.current.isBingo).toBe(false);
    expect(result.current.loadError).toBeNull();
  });

  it('does NOT set permissionDenied for a genuine "no active bingo" 404', async () => {
    mockedFetchWithAuth.mockResolvedValue(jsonResponse(404, { error: 'Not found' }));

    const { result } = renderHook(() => useBingoDetails());

    await waitFor(() => expect(result.current.isBingo).toBe(false));
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.loadError).toBeNull();
  });

  it('surfaces a real (non-permission) failure as loadError, distinct from permissionDenied', async () => {
    mockedFetchWithAuth.mockResolvedValue(jsonResponse(500, { error: 'Database unavailable' }));

    const { result } = renderHook(() => useBingoDetails());

    await waitFor(() => expect(result.current.loadError).toBe('Database unavailable (HTTP 500)'));
    expect(result.current.permissionDenied).toBe(false);
  });

  it('populates the form and clears permissionDenied on a successful 200', async () => {
    mockedFetchWithAuth.mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: 'bingo-1',
          name: 'Summer Bingo',
          status: 'active',
          boardSize: 16,
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-08-01T00:00:00.000Z',
          numberOfTeams: 2,
          teams: ['Red', 'Blue'],
          tasks: [],
        },
      }),
    );

    const { result } = renderHook(() => useBingoDetails());

    await waitFor(() => expect(result.current.isBingo).toBe(true));
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.bingoName).toBe('Summer Bingo');
    // Captured for useBingoLifecycle (End Early/Delete/Clone) — the create
    // form's fields alone don't carry the bingo's real id/status.
    expect(result.current.bingoId).toBe('bingo-1');
    expect(result.current.bingoStatus).toBe('active');
  });

  // Regression coverage for the useBingoLifecycle wiring: after a
  // destructive/lifecycle action (e.g. Delete), BingoLifecycle calls
  // refetchBingo to reset this form to whatever's left — a 404 there means
  // "nothing left", and the id/status captured above must reset with it,
  // not linger and point BingoLifecycle at a bingo that no longer exists.
  //
  // Direct regression for a bug caught in browser verification: the first
  // version of this reset only cleared isBingo/bingoId/bingoStatus, leaving
  // the just-deleted bingo's name/dates/board size/teams sitting on screen
  // right next to the "Add Bingo Details" button — a stale identity behind
  // a button that reads as "create fresh".
  it('refetchBingo clears every field (not just bingoId/bingoStatus/isBingo) when the bingo it pointed at is gone', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          id: 'bingo-1',
          name: 'Summer Bingo',
          status: 'draft',
          boardSize: 16,
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-08-01T00:00:00.000Z',
          numberOfTeams: 2,
          teams: ['Red', 'Blue'],
          tasks: [],
        },
      }),
    );

    const { result } = renderHook(() => useBingoDetails());
    await waitFor(() => expect(result.current.bingoId).toBe('bingo-1'));

    mockedFetchWithAuth.mockResolvedValueOnce(jsonResponse(404, {}));
    await act(async () => {
      await result.current.refetchBingo();
    });

    expect(result.current.isBingo).toBe(false);
    expect(result.current.bingoId).toBeNull();
    expect(result.current.bingoStatus).toBeUndefined();
    // The part the first fix missed:
    expect(result.current.bingoName).toBe('');
    expect(result.current.startDate).toBe('');
    expect(result.current.endDate).toBe('');
    expect(result.current.boardSize).toBe(16);
    expect(result.current.numberOfTeams).toBe(3);
    expect(result.current.teamNames).toEqual([]);
  });
});

describe('useBingoDetails — error-message formatting on submit (bug-report investigation, prod incident)', () => {
  it('carries the HTTP status and server message when creating bingo details fails with a 403 and empty body', async () => {
    // GET on mount: no existing bingo.
    mockedFetchWithAuth.mockResolvedValueOnce(jsonResponse(404, {}));
    // POST on submit: 403 with an empty body and no reason phrase — exactly
    // the shape that produced "Failed to send bingo details: " in prod.
    mockedFetchWithAuth.mockResolvedValueOnce(new Response('', { status: 403, statusText: '' }));

    const { result } = renderHook(() => useBingoDetails());
    await waitFor(() => expect(result.current.isBingo).toBe(false));

    act(() => {
      result.current.setBingoName('Test Bingo');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.submitError).toBe('Failed to create bingo details (HTTP 403)');
    expect(result.current.submitError).not.toMatch(/:\s*$/);
    expect(result.current.submitted).toBe(false);
  });

  it('surfaces the server error body verbatim (with status) when creation fails with a real error', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(jsonResponse(404, {}));
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(400, { error: 'End date must be after start date' }),
    );

    const { result } = renderHook(() => useBingoDetails());
    await waitFor(() => expect(result.current.isBingo).toBe(false));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.submitError).toBe('End date must be after start date (HTTP 400)');
  });
});
