import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/bingo`;

export type OnboardingProfile = {
  loading: boolean;
  error: string | null;
  teamId: string | null;
  teamName: string | null;
  /**
   * RSNs registered on the viewer's team for the active bingo (or just their
   * own row, pre-team-assignment). `GET /api/bingo/my-team-data` has no
   * "is this row mine" flag — it's built for team dashboards, not per-user
   * identity — so when more than one player is present we can't say which
   * one is "you". RsnStep is written to be honest about that rather than
   * guessing (see its comment).
   */
  rsns: string[];
  /** True once the fetch has settled (success, no-active-bingo, or error) — lets steps distinguish "still loading" from "loaded, nothing to show". */
  settled: boolean;
};

const INITIAL: OnboardingProfile = {
  loading: true,
  error: null,
  teamId: null,
  teamName: null,
  rsns: [],
  settled: false,
};

type MyTeamDataJson = {
  data?: {
    teamId?: string | null;
    teamName?: string;
    players?: Array<{ rsn: string }>;
  };
};

/**
 * Fetches the real `/api/bingo/my-team-data` endpoint (not mocked — it
 * already exists and is used by TeamData.tsx) for the RSN/Team onboarding
 * steps. Only fetches while `enabled` (the wizard is open).
 */
export const useOnboardingProfile = (enabled: boolean): OnboardingProfile => {
  const [state, setState] = useState<OnboardingProfile>(INITIAL);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const res = await fetchWithAuth(`${BASE_URL}/my-team-data`);

        // No active bingo is a normal state pre-season, not an error the
        // wizard should alarm the user with.
        if (res.status === 404) {
          if (!cancelled) {
            setState({ loading: false, error: null, teamId: null, teamName: null, rsns: [], settled: true });
          }
          return;
        }

        if (!res.ok) {
          const json = await res.json().catch(() => ({}) as { error?: string });
          throw new Error(json.error ?? res.statusText);
        }

        const json: MyTeamDataJson = await res.json();
        const data = json.data;
        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            teamId: data?.teamId ?? null,
            teamName: data?.teamId ? (data.teamName ?? null) : null,
            rsns: (data?.players ?? []).map((p) => p.rsn),
            settled: true,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            settled: true,
            error: e instanceof Error ? e.message : 'Failed to load your profile.',
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
};
