import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/bingo`;

export type PlayerProgress = {
  rsn: string;
  teamId: string | null;
  teamName: string;
  isCaptain: boolean;
  snapshotTakenAt: string | null;
  skillDeltas: Record<string, number>;
  activityDeltas: Record<string, number>;
};

export type TeamProgress = {
  teamId: string | null;
  teamName: string;
  players: PlayerProgress[];
};

export type TeamDataResponse = {
  bingoName: string;
  startDate: string;
  endDate: string;
  teams: TeamProgress[];
};

export const useTeamData = () => {
  const [data, setData] = useState<TeamDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/team-data`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? res.statusText);
      }
      const json = await res.json();
      setData(json.data ?? null);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load team data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  return { data, loading, error, lastUpdated, refresh: fetchTeamData };
};
