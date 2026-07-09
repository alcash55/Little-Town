import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { BingoConfig } from '../BingoDetails/useBingoDetails';
import { BingoTeam, BingoPlayer } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';
import { PendingScreenshotSubmission } from '../ScreenshotSubmission/useScreenshotSubmission';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

// Contract 3 (TEAM-BRIEF.md): GET /api/admin/bingo/player-stats -> { success: true, data: PlayerStat[] }
// `minutesOnline` from the old type is DROPPED — there is no data source for it.
export type PlayerStat = {
  rsn: string;
  teamName: string;
  tilesCompleted: number;
  totalPoints: number;
  /** ISO timestamp of last seen online */
  lastSeen: string | null;
  sideAccounts: string[];
};

// Contract 4: conflict detection is OUT this sprint (GET /bingo/conflicts does not
// exist). Real detection lands after side-account snapshots exist.

export const useBingoOverview = () => {
  const [bingo, setBingo] = useState<BingoConfig | null>(null);
  const [teams, setTeams] = useState<BingoTeam[]>([]);
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [playerStatsError, setPlayerStatsError] = useState<string | null>(null);
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

  // Contract 3: GET /api/admin/bingo/player-stats. The backend agent is implementing
  // this in parallel — while it 404s (or is otherwise unreachable) this degrades to an
  // empty list instead of crashing; the Player Stats card just shows "No player data yet."
  const fetchPlayerStats = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/player-stats`);
      if (!res.ok) {
        // 404 = endpoint not implemented yet (expected during parallel development).
        // Any other non-ok status is surfaced so a real backend failure isn't silent.
        setPlayerStats([]);
        setPlayerStatsError(res.status === 404 ? null : `Failed to load player stats (${res.status}).`);
        return;
      }
      const json = await res.json();
      setPlayerStats(Array.isArray(json.data) ? json.data : []);
      setPlayerStatsError(null);
    } catch {
      setPlayerStats([]);
      setPlayerStatsError('Failed to load player stats.');
    }
  }, []);

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
      await fetchPlayerStats();
      await fetchPendingScreenshots();
      setLoading(false);
    };
    load();
  }, [fetchBingo, fetchPlayersAndBoard, fetchPlayerStats, fetchPendingScreenshots]);

  // Contract 6: poll pending screenshots every 45s while the page is visible, so the
  // "N screenshots pending review" banner stays fresh without a manual refresh. Paused
  // while the tab is hidden (no review-in-flight state on this page, unlike
  // ScreenshotSubmission) and always cleaned up on unmount.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      interval = setInterval(fetchPendingScreenshots, 45_000);
    };
    const stop = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
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
    playerStatsError,
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
