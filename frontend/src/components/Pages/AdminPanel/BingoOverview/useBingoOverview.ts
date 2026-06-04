import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { BingoConfig } from '../BingoDetails/useBingoDetails';
import { BingoTeam, BingoPlayer } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

export type PlayerStat = {
  rsn: string;
  teamName: string;
  tilesCompleted: number;
  totalPoints: number;
  /** Total time online in minutes during the bingo window */
  minutesOnline: number;
  /** ISO timestamp of last seen online */
  lastSeen: string | null;
  sideAccounts: string[];
};

export type SideAccountConflict = {
  mainRsn: string;
  sideRsn: string;
  /** Both were online within this many minutes of each other */
  overlapMinutes: number;
  detectedAt: string;
};

export type PendingScreenshot = {
  id: string;
  submittedBy: string;
  tileName: string;
  submittedAt: string;
};

export const useBingoOverview = () => {
  const [bingo, setBingo] = useState<BingoConfig | null>(null);
  const [teams, setTeams] = useState<BingoTeam[]>([]);
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [conflicts, setConflicts] = useState<SideAccountConflict[]>([]);
  const [pendingScreenshots, setPendingScreenshots] = useState<PendingScreenshot[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start bingo now
  const [startingNow, setStartingNow] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // End bingo dialog
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endConfirmName, setEndConfirmName] = useState('');
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // Manual stats refresh
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [refreshStatsMessage, setRefreshStatsMessage] = useState<string | null>(null);

  const isActive = bingo?.status === 'active';
  const isPlanned = bingo?.status === 'planned' || (bingo && bingo.status !== 'active' && bingo.status !== 'ended');
  const endNameMatches = endConfirmName.trim().toLowerCase() === (bingo?.name ?? '').trim().toLowerCase();

  const fetchBingo = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/details`);
      if (!res.ok) { setBingo(null); return; }
      const json = await res.json();
      const data = json.data ?? null;
      setBingo(data);
      if (data?.teamObjects) {
        setTeams(
          [...data.teamObjects].sort((a: BingoTeam, b: BingoTeam) => a.sortOrder - b.sortOrder),
        );
      }
    } catch (e) {
      setError('Failed to load bingo details.');
    }
  }, []);

  const fetchPlayersAndBoard = useCallback(async () => {
    try {
      const [playersRes, boardRes] = await Promise.all([
        fetchWithAuth(`${BASE_URL}/bingo/players`),
        fetchWithAuth(`${BASE_URL}/bingo/board`),
      ]);
      if (playersRes.ok) {
        const json = await playersRes.json();
        setPlayers((json.data ?? []).map((row: any) => row.player ?? row));
      }
      if (boardRes.ok) {
        const json = await boardRes.json();
        setBoard(Array.isArray(json.data) ? json.data : []);
      }
    } catch { /* non-fatal */ }
  }, []);

  const fetchPlayerStats = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/player-stats`);
      if (!res.ok) return;
      const json = await res.json();
      setPlayerStats(json.data ?? []);
    } catch { /* non-fatal */ }
  }, []);

  const fetchConflicts = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/conflicts`);
      if (!res.ok) return;
      const json = await res.json();
      setConflicts(json.data ?? []);
    } catch { /* non-fatal */ }
  }, []);

  const fetchPendingScreenshots = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/screenshots/pending`);
      if (!res.ok) return;
      const json = await res.json();
      setPendingScreenshots(json.data ?? []);
    } catch { /* non-fatal */ }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchBingo();
      await fetchPlayersAndBoard();
      setLoading(false);
    };
    load();
  }, [fetchBingo, fetchPlayersAndBoard]);

  // Poll active-bingo data every 60s
  useEffect(() => {
    if (!isActive) return;
    fetchPlayerStats();
    fetchConflicts();
    fetchPendingScreenshots();
    const interval = setInterval(() => {
      fetchPlayerStats();
      fetchConflicts();
      fetchPendingScreenshots();
    }, 60_000);
    return () => clearInterval(interval);
  }, [isActive, fetchPlayerStats, fetchConflicts, fetchPendingScreenshots]);

  const refreshAllStats = useCallback(async () => {
    setRefreshingStats(true);
    setRefreshStatsMessage(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/players/refresh/snapshots`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setRefreshStatsMessage(json.message ?? 'Stats refreshed.');
      await fetchPlayerStats();
    } catch (e: any) {
      setRefreshStatsMessage(`Failed to refresh: ${e.message}`);
    } finally {
      setRefreshingStats(false);
    }
  }, [fetchPlayerStats]);

  const startNow = async () => {
    if (!bingo?.id) return;
    setStartingNow(true);
    setStartError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/activate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      await fetchBingo();
    } catch (e: any) {
      setStartError(e.message ?? 'Failed to start bingo.');
    } finally {
      setStartingNow(false);
    }
  };

  // Auto-activate when today's date matches the bingo start date and it isn't active yet
  useEffect(() => {
    if (!bingo || isActive) return;
    const startDate = new Date(bingo.startDate);
    const now = new Date();
    const sameDay =
      startDate.getFullYear() === now.getFullYear() &&
      startDate.getMonth() === now.getMonth() &&
      startDate.getDate() === now.getDate();
    if (!sameDay) return;

    // Fire-and-forget: trigger activation automatically
    fetchWithAuth(`${BASE_URL}/bingo/activate`, { method: 'POST' })
      .then((res) => { if (res.ok) fetchBingo(); })
      .catch(() => { /* silent — user can still press the button manually */ });
  }, [bingo?.startDate, isActive]);

  const endBingo = async () => {
    if (!bingo?.id || !endNameMatches) return;
    setEnding(true);
    setEndError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/${bingo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ end: new Date().toISOString(), status: 'ended' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setEndDialogOpen(false);
      setEndConfirmName('');
      await fetchBingo();
    } catch (e: any) {
      setEndError(e.message ?? 'Failed to end bingo.');
    } finally {
      setEnding(false);
    }
  };

  return {
    bingo,
    teams,
    players,
    board,
    playerStats,
    conflicts,
    pendingScreenshots,
    loading,
    error,
    isActive,
    isPlanned,
    // Start now
    startingNow,
    startError,
    startNow,
    // Stats refresh
    refreshingStats,
    refreshStatsMessage,
    refreshAllStats,
    // End dialog
    endDialogOpen,
    setEndDialogOpen,
    endConfirmName,
    setEndConfirmName,
    endNameMatches,
    ending,
    endError,
    endBingo,
  };
};
