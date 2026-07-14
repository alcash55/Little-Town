import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  classifyClaimStatus,
  filterAccountDerivedRsns,
  useRsnConfirmation,
} from './useRsnConfirmation';

// The hook goes through fetchWithAuth for every claim call — mocked here so
// these tests never touch the network, and so each test can script exactly
// which contract response (TEAM-BRIEF.md "Frozen contract") the claim
// endpoint returns.
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('filterAccountDerivedRsns', () => {
  // Direct regression test for the sprint's root cause (TEAM-BRIEF.md
  // Sprint 11 Track B #1): a roster entry that happens to equal the
  // signed-in user's username/nickname must never reach the RSN picker.
  it('strips a roster entry matching the username', () => {
    const out = filterAccountDerivedRsns(['PwnageBot', 'Real Osrs Name'], {
      username: 'PwnageBot',
      nickname: null,
    });
    expect(out).toEqual(['Real Osrs Name']);
  });

  it('strips a roster entry matching the nickname', () => {
    const out = filterAccountDerivedRsns(['Zeke', 'Real Osrs Name'], {
      username: 'pwnagebot',
      nickname: 'Zeke',
    });
    expect(out).toEqual(['Real Osrs Name']);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    const out = filterAccountDerivedRsns([' PWNAGEBOT ', 'Real Osrs Name'], {
      username: 'pwnageBot',
      nickname: null,
    });
    expect(out).toEqual(['Real Osrs Name']);
  });

  it('strips both username- and nickname-derived entries at once', () => {
    const out = filterAccountDerivedRsns(['PwnageBot', 'Zeke', 'Real Osrs Name'], {
      username: 'PwnageBot',
      nickname: 'Zeke',
    });
    expect(out).toEqual(['Real Osrs Name']);
  });

  it('leaves the list untouched when nothing matches the account', () => {
    const out = filterAccountDerivedRsns(['Real Osrs Name', 'Another Player'], {
      username: 'PwnageBot',
      nickname: 'Zeke',
    });
    expect(out).toEqual(['Real Osrs Name', 'Another Player']);
  });

  it('handles a null/undefined account (no session yet) without throwing', () => {
    expect(filterAccountDerivedRsns(['Real Osrs Name'], null)).toEqual(['Real Osrs Name']);
    expect(filterAccountDerivedRsns(['Real Osrs Name'], undefined)).toEqual(['Real Osrs Name']);
  });

  it('handles an account with no username/nickname set', () => {
    const out = filterAccountDerivedRsns(['Real Osrs Name'], { username: '', nickname: null });
    expect(out).toEqual(['Real Osrs Name']);
  });
});

describe('classifyClaimStatus', () => {
  it('maps 200 to valid', () => {
    expect(classifyClaimStatus(200)).toBe('valid');
  });

  it('maps 422 + RSN_NOT_FOUND to invalid', () => {
    expect(classifyClaimStatus(422, 'RSN_NOT_FOUND')).toBe('invalid');
  });

  it('maps 409 + RSN_TAKEN to taken', () => {
    expect(classifyClaimStatus(409, 'RSN_TAKEN')).toBe('taken');
  });

  it('treats a 422 without the expected code as down, not invalid', () => {
    expect(classifyClaimStatus(422, 'SOMETHING_ELSE')).toBe('down');
    expect(classifyClaimStatus(422, undefined)).toBe('down');
  });

  it('treats a 409 without the expected code as down, not taken', () => {
    expect(classifyClaimStatus(409, undefined)).toBe('down');
  });

  it('maps a 5xx / unmapped status to down', () => {
    expect(classifyClaimStatus(500)).toBe('down');
    expect(classifyClaimStatus(404)).toBe('down');
    expect(classifyClaimStatus(401)).toBe('down');
  });
});

describe('useRsnConfirmation', () => {
  it('starts idle/unconfirmed with nothing selected — no account-derived prefill', () => {
    const { result } = renderHook(() => useRsnConfirmation());
    expect(result.current.selected).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.confirmed).toBe(false);
  });

  it('keeps Next gated (unconfirmed) while a claim is in flight, then confirms on 200', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { rsn: 'Real Osrs Name', tracked: true, alreadyTracked: false }),
    );
    const { result } = renderHook(() => useRsnConfirmation());

    act(() => result.current.commit('real osrs name'));
    // Mid-flight: not confirmed yet.
    expect(result.current.confirmed).toBe(false);
    expect(result.current.status).toBe('validating');

    await waitFor(() => expect(result.current.status).toBe('valid'));
    expect(result.current.confirmed).toBe(true);
    // Reflects the server's canonical casing back into the field.
    expect(result.current.selected).toBe('Real Osrs Name');

    const [, init] = mockedFetchWithAuth.mock.calls[0];
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ rsn: 'real osrs name' }) });
  });

  it('422 RSN_NOT_FOUND leaves Next gated with an invalid status', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(jsonResponse(422, { code: 'RSN_NOT_FOUND' }));
    const { result } = renderHook(() => useRsnConfirmation());

    act(() => result.current.commit('NotARealPlayer'));
    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(result.current.confirmed).toBe(false);
  });

  it('409 RSN_TAKEN leaves Next gated with a taken status', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(jsonResponse(409, { code: 'RSN_TAKEN' }));
    const { result } = renderHook(() => useRsnConfirmation());

    act(() => result.current.commit('SomeoneElsesName'));
    await waitFor(() => expect(result.current.status).toBe('taken'));
    expect(result.current.confirmed).toBe(false);
  });

  it('a service-down response leaves Next gated until an explicit soft-pass', async () => {
    mockedFetchWithAuth.mockRejectedValueOnce(new Error('network error'));
    const { result } = renderHook(() => useRsnConfirmation());

    act(() => result.current.commit('Real Osrs Name'));
    await waitFor(() => expect(result.current.status).toBe('down'));
    expect(result.current.confirmed).toBe(false);
    expect(result.current.failures).toBe(1);

    act(() => result.current.softPass());
    expect(result.current.status).toBe('soft-passed');
    expect(result.current.confirmed).toBe(true);
  });

  it('clearing the typed value resets to idle/unconfirmed', async () => {
    mockedFetchWithAuth.mockResolvedValueOnce(
      jsonResponse(200, { rsn: 'Real Osrs Name', tracked: true, alreadyTracked: false }),
    );
    const { result } = renderHook(() => useRsnConfirmation());

    act(() => result.current.commit('Real Osrs Name'));
    await waitFor(() => expect(result.current.status).toBe('valid'));

    act(() => result.current.commit(null));
    expect(result.current.status).toBe('idle');
    expect(result.current.selected).toBeNull();
    expect(result.current.confirmed).toBe(false);
  });
});
