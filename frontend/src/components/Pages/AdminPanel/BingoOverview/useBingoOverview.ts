import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { BingoConfig } from '../BingoDetails/useBingoDetails';
import { BingoTeam, BingoPlayer } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';
import { PendingScreenshotSubmission } from '../ScreenshotSubmission/useScreenshotSubmission';

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

export const useBingoOverview = () => {
  const [bingo, setBingo] = useState<BingoConfig | null>(null);
  const [teams, setTeams] = useState<BingoTeam[]>([]);
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [conflicts, setConflicts] = useState<SideAccountConflict[]>([]);
  const [pendingScreenshots, setPendingScreenshots] = useState<PendingScreenshotSubmission[]>([]);

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
  const isPlanned = bingo?.status === 'planned' || (bingo && bingo.status !== 'active' && bingo.status !== 'complete');
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

  // TODO: GET /bingo/player-stats and /bingo/conflicts do not exist on the backend
  // yet. playerStats/conflicts stay empty (UI sections that depend on them just
  // stay hidden) until those endpoints are implemented.

  const fetchPendingScreenshots = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/screenshots/pending`);
      if (!res.ok) return;
      const json = await res.json();
      setPendingScreenshots(Array.isArray(json.data) ? json.data : []);
    } catch {
      /* non-fatal: the pending-review banner just keeps its last known count */
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchBingo();
      await fetchPlayersAndBoard();
      await fetchPendingScreenshots();
      setLoading(false);
    };
    load();
  }, [fetchBingo, fetchPlayersAndBoard, fetchPendingScreenshots]);

  // Poll pending screenshots every 30s while the overview page is mounted so the
  // "N screenshots pending review" banner stays fresh without a manual refresh.
  useEffect(() => {
    const interval = setInterval(fetchPendingScreenshots, 30_000);
    return () => clearInterval(interval);
  }, [fetchPendingScreenshots]);

  const clearRefreshStatsMessage = useCallback(() => setRefreshStatsMessage(null), []);

  // Auto-dismiss the refresh message after 8 seconds
  useEffect(() => {
    if (!refreshStatsMessage) return;
    const t = setTimeout(() => setRefreshStatsMessage(null), 8_000);
    return () => clearTimeout(t);
  }, [refreshStatsMessage]);

  const refreshAllStats = useCallback(async () => {
    setRefreshingStats(true);
    setRefreshStatsMessage(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/players/refresh/snapshots`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setRefreshStatsMessage(json.message ?? 'Stats refreshed.');
    } catch (e: any) {
      setRefreshStatsMessage(`Failed to refresh: ${e.message}`);
    } finally {
      setRefreshingStats(false);
    }
  }, []);

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

  const endBingo = async () => {
    if (!bingo?.id || !endNameMatches) return;
    setEnding(true);
    setEndError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/${bingo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ endDate: new Date().toISOString(), status: 'complete' }),
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
    clearRefreshStatsMessage,
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
