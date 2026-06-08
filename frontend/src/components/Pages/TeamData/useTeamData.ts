import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/bingo`;

export type TileInfo = {
  task: string;
  type: 'Kill Count' | 'Experience' | 'Drops';
  points: number;
  target: number | null;
};

export type PlayerRow = {
  rsn: string;
  playerId: string;
  teamId: string | null;
  teamName: string;
  isCaptain: boolean;
  snapshotTakenAt: string | null;
  skillDeltas: Record<string, number>;
  activityDeltas: Record<string, number>;
  /** For Drops tiles: task name → 'approved' | 'pending' */
  dropStatus: Record<string, 'approved' | 'pending'>;
};

export type MyTeamDataResponse = {
  bingoName: string;
  startDate: string;
  endDate: string;
  teamId: string | null;
  teamName: string;
  tiles: TileInfo[];
  players: PlayerRow[];
};

export const useTeamData = () => {
  const [data, setData] = useState<MyTeamDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/my-team-data`);
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
