import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTeamDrafter, normalizeRsnForMatch } from './useTeamDrafter';
// Cross-package import by relative path, not a published module — the
// frontend build never ships this file, but a test file can reach across
// the repo to compare the two copies directly (issue #49). If this import
// starts failing to resolve, backend/src/lib/rsn.ts moved or was renamed;
// update the path rather than deleting the test.
import { canonicalizeRsn, normalizeRsn } from '../../../../../../backend/src/lib/rsn';

// Every request goes through fetchWithAuth — mocked so these tests never
// touch the network (same convention as useBingoOverview.test.ts /
// useBoardBuilder.test.ts).
vi.mock('../../../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const BINGO_DETAILS = {
  data: {
    id: 'bingo-1',
    teamObjects: [{ id: 'team-1', name: 'Gold Team', sortOrder: 0 }],
  },
};

const PLAYERS = {
  data: [
    { player: { id: 'p-zezima', bingo_id: 'bingo-1', team_id: 'team-1', captain_team_id: null, rsn: 'Zezima', registered_by: null, registered_at: '2026-01-01' } },
    { player: { id: 'p-woox', bingo_id: 'bingo-1', team_id: 'team-1', captain_team_id: null, rsn: 'Woox', registered_by: null, registered_at: '2026-01-01' } },
    // Underscore + trailing space variant to prove the match survives it —
    // mirrors backend/src/lib/rsn.ts canonicalizeRsn's underscore-as-space rule.
    { player: { id: 'p-lynx', bingo_id: 'bingo-1', team_id: 'team-1', captain_team_id: null, rsn: 'Lynx_Titan', registered_by: null, registered_at: '2026-01-01' } },
  ],
};

const RSN_CLAIMS = {
  data: [
    { userId: 'u-linked', username: 'Linkeduser', rsn: 'Zezima', rsnNormalized: 'zezima', claimedAt: '2026-01-02' },
    // Claim's stored rsn/rsnNormalized already reflects the canonical "Lynx Titan"
    // form (spaces, not underscores) — proving the pool's underscore variant
    // still matches via normalizeRsnForMatch.
    { userId: 'u-lynx', username: 'Lynxuser', rsn: 'Lynx Titan', rsnNormalized: 'lynx titan', claimedAt: '2026-01-03' },
  ],
};

const ADMIN_USERS = {
  users: [
    { id: 'u-target', label: 'Targetuser', role: 'user' },
    { id: 'u-linked', label: 'Linkeduser', role: 'user' },
  ],
};

type RouteHandler = (url: string, options: RequestInit | undefined) => Response | null;

function installRouter(handlers: RouteHandler[] = []) {
  mockedFetchWithAuth.mockImplementation(async (url: string, options?: RequestInit) => {
    for (const handler of handlers) {
      const res = handler(url, options);
      if (res) return res;
    }
    const method = options?.method ?? 'GET';
    if (method === 'GET' && url.includes('/bingo/details')) return jsonResponse(200, BINGO_DETAILS);
    if (method === 'GET' && url.includes('/bingo/players')) return jsonResponse(200, PLAYERS);
    if (method === 'GET' && url.endsWith('/rsn-claims')) return jsonResponse(200, RSN_CLAIMS);
    if (method === 'GET' && url.endsWith('/users')) return jsonResponse(200, ADMIN_USERS);
    return jsonResponse(200, { data: [] });
  });
}

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeRsnForMatch', () => {
  it('mirrors backend canonicalizeRsn + normalizeRsn: underscores as spaces, collapsed whitespace, lowercased', () => {
    expect(normalizeRsnForMatch('Lynx_Titan')).toBe('lynx titan');
    expect(normalizeRsnForMatch('  Zezima  ')).toBe('zezima');
    expect(normalizeRsnForMatch('B0aty')).toBe('b0aty');
    expect(normalizeRsnForMatch('Multi   Space')).toBe('multi space');
  });

  // Issue #49: normalizeRsnForMatch duplicates backend/src/lib/rsn.ts's
  // canonicalizeRsn + normalizeRsn rather than importing them (the frontend
  // build can't reach into backend/src). This test imports the real backend
  // module by relative path and runs both implementations over the same
  // fixture list, so if either side changes without the other, this fails
  // instead of the two silently drifting apart in production.
  it('is byte-identical to backend canonicalizeRsn + normalizeRsn for every fixture', () => {
    const fixtures = [
      'Lynx_Titan',
      '  Zezima  ',
      'B0aty',
      'Multi   Space',
      'UPPER_CASE_NAME',
      'trailing_',
      '_leading',
      'a',
      '  ',
      'Mixed_Case Name  With_Both',
    ];

    for (const raw of fixtures) {
      const backendResult = normalizeRsn(canonicalizeRsn(raw));
      expect(normalizeRsnForMatch(raw)).toBe(backendResult);
    }
  });
});

describe('useTeamDrafter — RSN claims admin (TEAM-BRIEF.md Sprint 17, Track B2)', () => {
  it('loads rsn-claims on mount', async () => {
    installRouter();
    const { result } = renderHook(() => useTeamDrafter());

    await waitFor(() => expect(result.current.loadingRsnClaims).toBe(false));
    expect(result.current.rsnClaims).toHaveLength(2);
    expect(result.current.rsnClaims[0].rsn).toBe('Zezima');
  });

  it('surfaces a load error via describeApiError rather than crashing', async () => {
    installRouter([
      (url, options) =>
        (options?.method ?? 'GET') === 'GET' && url.endsWith('/rsn-claims')
          ? jsonResponse(500, { error: 'Database unavailable' })
          : null,
    ]);
    const { result } = renderHook(() => useTeamDrafter());

    await waitFor(() => expect(result.current.loadingRsnClaims).toBe(false));
    expect(result.current.rsnClaimsError).toBe('Database unavailable (HTTP 500)');
    expect(result.current.rsnClaims).toEqual([]);
  });

  // Item 2 of the brief: a bingo_players row with no rsn_claims row pointing
  // at it never sees its own team data — flagged here so Alex can chase it.
  // There's no route joining the two tables, so this is the client-side
  // match GET /admin/rsn-claims + the drafter's own player pool.
  describe('unclaimed pool flagging', () => {
    it('flags players with no matching claim and leaves claimed ones alone', async () => {
      installRouter();
      const { result } = renderHook(() => useTeamDrafter());

      await waitFor(() => expect(result.current.loadingRsnClaims).toBe(false));
      await waitFor(() => expect(result.current.loadingPlayers).toBe(false));

      const unclaimedRsns = result.current.unclaimedPlayers.map((p) => p.rsn).sort();
      // Zezima and Lynx_Titan both resolve to claimed rsns (the latter only
      // via underscore-as-space normalization); Woox has no claim at all.
      expect(unclaimedRsns).toEqual(['Woox']);
      expect(result.current.unclaimedPlayerIds.has('p-woox')).toBe(true);
      expect(result.current.unclaimedPlayerIds.has('p-zezima')).toBe(false);
      expect(result.current.unclaimedPlayerIds.has('p-lynx')).toBe(false);
    });

    it('does not flag anyone while claims are still loading (avoids a flash of false positives)', async () => {
      mockedFetchWithAuth.mockImplementation(async (url: string, options?: RequestInit) => {
        const method = options?.method ?? 'GET';
        // rsn-claims deliberately never resolves within this test, so
        // loadingRsnClaims stays true for the whole assertion window.
        if (method === 'GET' && url.endsWith('/rsn-claims')) return new Promise<Response>(() => {});
        if (method === 'GET' && url.includes('/bingo/details')) return jsonResponse(200, BINGO_DETAILS);
        if (method === 'GET' && url.includes('/bingo/players')) return jsonResponse(200, PLAYERS);
        return jsonResponse(200, { data: [] });
      });

      const { result } = renderHook(() => useTeamDrafter());
      await waitFor(() => expect(result.current.loadingPlayers).toBe(false));

      expect(result.current.loadingRsnClaims).toBe(true);
      expect(result.current.unclaimedPlayers).toEqual([]);
    });
  });

  describe('release', () => {
    it('DELETEs the exact rsnNormalized and refreshes the list on success', async () => {
      let deleteCall: { url: string; method: string } | null = null;
      installRouter([
        (url, options) => {
          if (options?.method === 'DELETE') {
            deleteCall = { url, method: options.method };
            return jsonResponse(200, { success: true, data: { released: true } });
          }
          return null;
        },
      ]);
      const { result } = renderHook(() => useTeamDrafter());
      await waitFor(() => expect(result.current.loadingRsnClaims).toBe(false));

      act(() => result.current.openReleaseClaimDialog(result.current.rsnClaims[0]));
      expect(result.current.releaseClaimTarget?.rsn).toBe('Zezima');

      await act(async () => {
        await result.current.confirmReleaseClaim();
      });

      expect(deleteCall).toEqual({ url: expect.stringContaining('/rsn-claims/zezima'), method: 'DELETE' });
      expect(result.current.releaseClaimTarget).toBeNull();
      expect(result.current.releaseClaimError).toBeNull();
    });

    it('surfaces a release failure without closing the dialog', async () => {
      installRouter([
        (url, options) =>
          options?.method === 'DELETE' ? jsonResponse(404, { success: false, error: 'No RSN claim found for "zezima"' }) : null,
      ]);
      const { result } = renderHook(() => useTeamDrafter());
      await waitFor(() => expect(result.current.loadingRsnClaims).toBe(false));

      act(() => result.current.openReleaseClaimDialog(result.current.rsnClaims[0]));
      await act(async () => {
        await result.current.confirmReleaseClaim();
      });

      expect(result.current.releaseClaimTarget).not.toBeNull();
      expect(result.current.releaseClaimError).toBe('No RSN claim found for "zezima" (HTTP 404)');
    });
  });

  describe('reassign', () => {
    it('lazy-loads the admin/users picker only when the dialog opens, then PATCHes { userId } on confirm', async () => {
      let patchBody: unknown = null;
      installRouter([
        (url, options) => {
          if (options?.method === 'PATCH') {
            patchBody = JSON.parse(options.body as string);
            return jsonResponse(200, { success: true, data: { rsn: 'Zezima', userId: 'u-target' } });
          }
          return null;
        },
      ]);
      const { result } = renderHook(() => useTeamDrafter());
      await waitFor(() => expect(result.current.loadingRsnClaims).toBe(false));

      expect(result.current.adminUsers).toBeNull();
      act(() => result.current.openReassignClaimDialog(result.current.rsnClaims[0]));
      await waitFor(() => expect(result.current.loadingAdminUsers).toBe(false));
      expect(result.current.adminUsers).toHaveLength(2);

      act(() => result.current.setReassignClaimUser(result.current.adminUsers![0]));
      await act(async () => {
        await result.current.confirmReassignClaim();
      });

      expect(patchBody).toEqual({ userId: 'u-target' });
      expect(result.current.reassignClaimTarget).toBeNull();
    });

    // TEAM-BRIEF.md: "the 409 (target user already holds a different claim)
    // must produce a message that names the conflict, not a generic
    // failure" — db/rsnClaims.ts's message already names the conflicting
    // RSN, so this proves it survives all the way to the UI's error state.
    it('surfaces the 409 conflict message verbatim, naming the conflicting RSN', async () => {
      installRouter([
        (url, options) =>
          options?.method === 'PATCH'
            ? jsonResponse(409, {
                error: 'User already holds a different RSN claim ("B0aty")',
                code: 'RSN_CLAIM_CONFLICT',
              })
            : null,
      ]);
      const { result } = renderHook(() => useTeamDrafter());
      await waitFor(() => expect(result.current.loadingRsnClaims).toBe(false));

      act(() => result.current.openReassignClaimDialog(result.current.rsnClaims[0]));
      await waitFor(() => expect(result.current.loadingAdminUsers).toBe(false));
      act(() => result.current.setReassignClaimUser(result.current.adminUsers![0]));

      await act(async () => {
        await result.current.confirmReassignClaim();
      });

      expect(result.current.reassignClaimError).toBe(
        'User already holds a different RSN claim ("B0aty") (HTTP 409)',
      );
      // Dialog stays open so the admin can pick a different target.
      expect(result.current.reassignClaimTarget).not.toBeNull();
    });
  });
});
