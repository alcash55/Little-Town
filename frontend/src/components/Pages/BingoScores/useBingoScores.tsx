import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/bingo`;

// TEAM-BRIEF.md Track A item 3 (frozen contract): GET /api/bingo/team-xp-history
// -> bare `{ teams: [...] }`, authed at the same level as other bingo read
// endpoints (`protect`, no admin/moderator requirement). Sourced from
// bingo_player_hiscore_history, daily-bucketed, main accounts only for the
// headline series per Track A's report.
export interface TeamXpSeriesPoint {
  date: string; // ISO-8601
  totalXpGained: number;
}

export interface TeamXpHistory {
  teamId: string;
  teamName: string;
  series: TeamXpSeriesPoint[];
}

export const useBingoScores = () => {
  const [teams, setTeams] = useState<TeamXpHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/team-xp-history`);
      if (!res.ok) {
        // 404 = "no active bingo found" (see backend/src/routes/bingo.ts) —
        // a real, documented state rather than a failure, and one the empty
        // state below already covers ("Once the bingo is active…").
        if (res.status === 404) {
          setTeams([]);
          return;
        }
        throw new Error(`Failed to load team XP history (${res.status}).`);
      }
      const json: { teams?: TeamXpHistory[] } = await res.json();
      setTeams(Array.isArray(json.teams) ? json.teams : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team XP history.');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return { teams, loading, error, refetch: fetchHistory };
};
