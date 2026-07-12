import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { BingoConfig } from '../BingoDetails/useBingoDetails';
import { BingoTeam, BingoPlayer } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';
import { PendingScreenshotSubmission } from '../ScreenshotSubmission/useScreenshotSubmission';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;
const BINGO_BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/bingo`;

// Contract 3 (TEAM-BRIEF.md, Sprint 5 Track A item 1): GET /api/admin/bingo/player-stats
// -> { success: true, data: PlayerStat[] }. `minutesOnline` from the old type is DROPPED —
// there is no data source for it. rsnStale/rsnStaleSince surface RSN-change detection: true
// when the player's on-file RSN currently has an unresolved rsn_change_log entry (most
// recent hiscore lookup for it 404'd).
export type PlayerStat = {
  rsn: string;
  teamName: string;
  tilesCompleted: number;
  totalPoints: number;
  /** ISO timestamp of last seen online */
  lastSeen: string | null;
  sideAccounts: string[];
  rsnStale: boolean;
  rsnStaleSince: string | null;
};

// TEAM-BRIEF.md Track A item 4 (frozen contract): GET /api/admin/health/dependencies.
// Bare `{ services: [...] }` response — no success/data envelope. Cached ~60s
// server-side, so this page's poll can hit it freely.
export type DependencyStatus = 'up' | 'degraded' | 'down' | 'unknown';

export type ServiceHealth = {
  id: string;
  label: string;
  status: DependencyStatus;
  latencyMs?: number;
  detail?: string;
  checkedAt: string;
};

// TEAM-BRIEF.md Track B (frozen contract): GET /api/bingo/:bingoId/conflicts.
// Bare `{ conflicts: [...] }` response, same bare-object style as dependency health.
export type ConflictWindow = {
  start: string;
  end: string;
  mainXpGained: number;
  sideXpGained: number;
};

export type PlayerConflict = {
  playerId: string;
  rsn: string;
  sideRsn: string;
  windows: ConflictWindow[];
  severity: 'low' | 'high';
};

export const useBingoOverview = () => {
  const [bingo, setBingo] = useState<BingoConfig | null>(null);
  const [teams, setTeams] = useState<BingoTeam[]>([]);
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [playerStatsError, setPlayerStatsError] = useState<string | null>(null);
  const [pendingScreenshots, setPendingScreenshots] = useState<PendingScreenshotSubmission[]>([]);
  const [health, setHealth] = useState<ServiceHealth[]>([]);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<PlayerConflict[]>([]);
  const [conflictsError, setConflictsError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tracks the active bingo id across renders without re-subscribing the poll
  // effect below every time `bingo` changes.
  const bingoIdRef = useRef<string | null>(null);

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

  const fetchBingo = useCallback(async (): Promise<BingoConfig | null> => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/details`);
      if (!res.ok) { setBingo(null); bingoIdRef.current = null; return null; }
      const json = await res.json();
      // The bingo details response also carries `teamObjects` (backend
      // src/types/index.ts) — not part of the frontend BingoConfig type
      // (pre-existing gap, unrelated to this ticket's scope), so it's read
      // via a locally-widened type rather than `any`.
      const data: (BingoConfig & { teamObjects?: BingoTeam[] }) | null = json.data ?? null;
      setBingo(data);
      bingoIdRef.current = data?.id ?? null;
      if (data?.teamObjects) {
        setTeams(
          [...data.teamObjects].sort((a: BingoTeam, b: BingoTeam) => a.sortOrder - b.sortOrder),
        );
      }
      return data;
    } catch (e) {
      setError('Failed to load bingo details.');
      return null;
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

  // TEAM-BRIEF.md Track A item 4: GET /api/admin/health/dependencies. Bare
  // `{ services: [...] }`, admin auth, ~60s server-side cache — safe to hit on the
  // same 45s page poll. A failure here is non-fatal to the page; the Dependency
  // Health card just shows its own error state.
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/health/dependencies`);
      if (!res.ok) {
        setHealthError(`Failed to load dependency health (${res.status}).`);
        return;
      }
      const json = await res.json();
      setHealth(Array.isArray(json.services) ? json.services : []);
      setHealthError(null);
    } catch {
      setHealthError('Failed to load dependency health.');
    }
  }, []);

  // TEAM-BRIEF.md Track B: GET /api/bingo/:bingoId/conflicts. Bare
  // `{ conflicts: [...] }`. Requires a bingo id — no-ops (clears state) when
  // there is none, e.g. before a bingo has ever been created.
  const fetchConflicts = useCallback(async (bingoId: string | null) => {
    if (!bingoId) {
      setConflicts([]);
      setConflictsError(null);
      return;
    }
    try {
      const res = await fetchWithAuth(`${BINGO_BASE_URL}/${bingoId}/conflicts`);
      if (!res.ok) {
        setConflictsError(`Failed to load conflicts (${res.status}).`);
        return;
      }
      const json = await res.json();
      setConflicts(Array.isArray(json.conflicts) ? json.conflicts : []);
      setConflictsError(null);
    } catch {
      setConflictsError('Failed to load conflicts.');
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const bingoData = await fetchBingo();
      await Promise.all([
        fetchPlayersAndBoard(),
        fetchPlayerStats(),
        fetchPendingScreenshots(),
        fetchHealth(),
        fetchConflicts(bingoData?.id ?? null),
      ]);
      setLoading(false);
    };
    load();
  }, [fetchBingo, fetchPlayersAndBoard, fetchPlayerStats, fetchPendingScreenshots, fetchHealth, fetchConflicts]);

  // Contract 6: poll pending screenshots, dependency health, and conflicts every 45s
  // while the page is visible, so the "N screenshots pending review" banner and the
  // health/conflicts cards stay fresh without a manual refresh. Paused while the tab
  // is hidden, or while a previous tick's requests are still in flight (a slow
  // dependency-health check — up to a 5s timeout per upstream, five upstreams — must
  // not stack overlapping polls), and always cleaned up on unmount.
  const pollingRef = useRef(false);
  const pollTick = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      await Promise.all([
        fetchPendingScreenshots(),
        fetchHealth(),
        fetchConflicts(bingoIdRef.current),
      ]);
    } finally {
      pollingRef.current = false;
    }
  }, [fetchPendingScreenshots, fetchHealth, fetchConflicts]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      interval = setInterval(pollTick, 45_000);
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
  }, [pollTick]);

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
    health,
    healthError,
    conflicts,
    conflictsError,
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
