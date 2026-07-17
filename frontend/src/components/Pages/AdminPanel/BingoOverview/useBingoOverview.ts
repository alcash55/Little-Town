import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { describeApiError } from '../../../../utils/apiError';
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

// GET /api/admin/bingo/team-stats -> { success: true, data: TeamStat[] }.
// Additive sibling to player-stats (bug-report investigation, see todo.md):
// player-level stats are undercounted whenever an admin approves a
// screenshot without picking a player (the "Player (optional)" field on
// ScreenshotCard) — the tile still counts for the TEAM (this is
// attribution-independent, computed straight from team_id), it just can't
// be attributed to anyone specific. unattributedTiles/unattributedPoints
// isolate exactly that gap so it's visible instead of silently missing from
// the per-player table below.
export type TeamStat = {
  teamId: string;
  teamName: string;
  tilesCompleted: number;
  totalPoints: number;
  unattributedTiles: number;
  unattributedPoints: number;
};

// TEAM-BRIEF.md Sprint 13, Track A item 1 (frozen contract): GET
// /api/admin/bingo/team-stats additionally returns `unresolvableTiles` —
// trackable-type (Kill Count/Experience) tiles whose `task` text couldn't be
// mapped to a hiscore metric by the completion engine, so they can NEVER
// auto-complete as-is. Surfaced as an admin warning (see BingoOverview)
// pointing at Board Builder, since the fix is almost always retyping the
// task to match the hiscores autocomplete vocabulary exactly.
export type UnresolvableTile = {
  id: string;
  task: string;
  type: 'Kill Count' | 'Experience';
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

// TEAM-BRIEF.md Sprint 15, Track A item 3 (frozen contract): GET
// /api/admin/bingo/latest -> { success, data: { bingo: BingoConfig | null,
// pendingScreenshots: number } } — the most recent bingo REGARDLESS of
// status (draft/active/complete/archived; null only if none exist ever),
// plus its pending-submission count. This is how the overview resolves "the
// bingo" once it's gone complete, since GET /bingo/details stays
// active|draft-only by contract (item 26) and would otherwise report null —
// indistinguishable from "no bingo has ever been created" — for a bingo
// that just ended.
type LatestBingoResponse = {
  bingo: (BingoConfig & { teamObjects?: BingoTeam[] }) | null;
  pendingScreenshots: number;
};

export const useBingoOverview = () => {
  const [bingo, setBingo] = useState<BingoConfig | null>(null);
  const [teams, setTeams] = useState<BingoTeam[]>([]);
  const [players, setPlayers] = useState<BingoPlayer[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [playerStatsError, setPlayerStatsError] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);
  const [unresolvableTiles, setUnresolvableTiles] = useState<UnresolvableTile[]>([]);
  const [pendingScreenshots, setPendingScreenshots] = useState<PendingScreenshotSubmission[]>([]);
  const [health, setHealth] = useState<ServiceHealth[]>([]);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<PlayerConflict[]>([]);
  const [conflictsError, setConflictsError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True when the gating GET (bingo details / latest) 401/403'd — distinct
  // from "no bingo has been set up yet" so the page shows a permission-denied
  // state instead of an empty page that invites re-entering setup (same
  // pattern as BingoDetails/BoardBuilder — bug-report investigation, prod
  // incident).
  const [permissionDenied, setPermissionDenied] = useState(false);
  // TEAM-BRIEF.md Sprint 15, Track A item 3 / decision 4a: pendingScreenshots
  // count straight from GET /bingo/latest, used ONLY to drive the
  // "Bingo ended with N screenshots awaiting review" banner below — distinct
  // from `pendingScreenshots` (the full submission list from
  // /bingo/screenshots/pending, which already works for any bingo status per
  // Track A's review-endpoint audit) so the ended-banner's count reflects the
  // frozen contract's own field rather than a second derived source.
  const [latestPendingCount, setLatestPendingCount] = useState(0);

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
  const isComplete = bingo?.status === 'complete';
  const isPlanned =
    bingo?.status === 'planned' ||
    (!!bingo && bingo.status !== 'active' && bingo.status !== 'complete' && bingo.status !== 'archived');
  const endNameMatches = endConfirmName.trim().toLowerCase() === (bingo?.name ?? '').trim().toLowerCase();

  const applyBingoData = useCallback(
    (data: (BingoConfig & { teamObjects?: BingoTeam[] }) | null) => {
      setBingo(data);
      bingoIdRef.current = data?.id ?? null;
      if (data?.teamObjects) {
        setTeams(
          [...data.teamObjects].sort((a: BingoTeam, b: BingoTeam) => a.sortOrder - b.sortOrder),
        );
      }
    },
    [],
  );

  // TEAM-BRIEF.md Sprint 15, Track A item 3 (frozen contract): GET
  // /bingo/latest. Resolves "the bingo" once GET /bingo/details reports null
  // (either a just-completed bingo, or genuinely none ever created — the
  // response's `bingo` field distinguishes the two).
  const fetchLatest = useCallback(async (): Promise<BingoConfig | null> => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/latest`);
      if (!res.ok) {
        const info = await describeApiError(res, 'Failed to load bingo status');
        if (info.isPermissionError) {
          setPermissionDenied(true);
        } else {
          setError(info.message);
        }
        applyBingoData(null);
        setLatestPendingCount(0);
        return null;
      }
      setPermissionDenied(false);
      const json = await res.json();
      const data: LatestBingoResponse | null = json.data ?? null;
      applyBingoData(data?.bingo ?? null);
      setLatestPendingCount(typeof data?.pendingScreenshots === 'number' ? data.pendingScreenshots : 0);
      return data?.bingo ?? null;
    } catch {
      setError('Failed to load bingo status.');
      return null;
    }
  }, [applyBingoData]);

  const fetchBingo = useCallback(async (): Promise<BingoConfig | null> => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/details`);
      if (!res.ok) {
        const info = await describeApiError(res, 'Failed to load bingo details');
        if (info.isPermissionError) {
          setPermissionDenied(true);
          applyBingoData(null);
          return null;
        }
        if (res.status !== 404) {
          setError(info.message);
          applyBingoData(null);
          return null;
        }
        // Unexpected 404 for this endpoint — still worth checking /latest.
        return await fetchLatest();
      }
      setPermissionDenied(false);
      const json = await res.json();
      // The bingo details response also carries `teamObjects` (backend
      // src/types/index.ts) — not part of the frontend BingoConfig type
      // (pre-existing gap, unrelated to this ticket's scope), so it's read
      // via a locally-widened type rather than `any`.
      const data: (BingoConfig & { teamObjects?: BingoTeam[] }) | null = json.data ?? null;
      if (data) {
        applyBingoData(data);
        setLatestPendingCount(0);
        return data;
      }
      // No active/draft bingo — /bingo/details is active|draft-only by
      // contract, so a just-completed bingo also reports null here. Fall
      // back to /bingo/latest so the overview can tell "just ended" apart
      // from "nothing has ever been created" instead of always rendering
      // the pre-Sprint-15 empty state.
      return await fetchLatest();
    } catch (e) {
      setError('Failed to load bingo details.');
      return null;
    }
  }, [applyBingoData, fetchLatest]);

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

  // Additive sibling to player-stats (see TeamStat's doc comment above).
  // Best-effort: a failure here just means the top KPI tiles/attribution
  // banner fall back to the (possibly under-reporting) player-stats total
  // rather than failing the whole page.
  const fetchTeamStats = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/team-stats`);
      if (!res.ok) {
        setTeamStats([]);
        setUnresolvableTiles([]);
        return;
      }
      const json = await res.json();
      setTeamStats(Array.isArray(json.data) ? json.data : []);
      // See UnresolvableTile's doc comment above — additive sibling field on
      // the same response, not nested under `data`.
      setUnresolvableTiles(Array.isArray(json.unresolvableTiles) ? json.unresolvableTiles : []);
    } catch {
      setTeamStats([]);
      setUnresolvableTiles([]);
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
        fetchTeamStats(),
        fetchPendingScreenshots(),
        fetchHealth(),
        fetchConflicts(bingoData?.id ?? null),
      ]);
      setLoading(false);
    };
    load();
  }, [
    fetchBingo,
    fetchPlayersAndBoard,
    fetchPlayerStats,
    fetchTeamStats,
    fetchPendingScreenshots,
    fetchHealth,
    fetchConflicts,
  ]);

  // Contract 6: poll pending screenshots, dependency health, conflicts, and both
  // stats views every 45s while the page is visible, so the "N screenshots pending
  // review" banner, the health/conflicts cards, and the Player Stats table all stay
  // fresh without a manual refresh or hard reload. Paused while the tab is hidden, or
  // while a previous tick's requests are still in flight (a slow dependency-health
  // check — up to a 5s timeout per upstream, five upstreams — must not stack
  // overlapping polls), and always cleaned up on unmount.
  //
  // fetchPlayerStats was missing from this list until the attribution-gap
  // investigation (bug-report investigation, H1 follow-up): an admin who backfills a
  // submission's player_id via the ScreenshotSubmission page's "Needs Player
  // Attribution" worklist, then flips back to an ALREADY-OPEN BingoOverview tab,
  // would see the Player Stats table stay stale for up to 45s longer than every other
  // card on this page (teamStats was already polled; playerStats was not) — the fix
  // below makes it match teamStats' freshness instead of silently lagging behind it.
  const pollingRef = useRef(false);
  const pollTick = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      await Promise.all([
        fetchPendingScreenshots(),
        fetchHealth(),
        fetchConflicts(bingoIdRef.current),
        fetchTeamStats(),
        fetchPlayerStats(),
      ]);
    } finally {
      pollingRef.current = false;
    }
  }, [fetchPendingScreenshots, fetchHealth, fetchConflicts, fetchTeamStats, fetchPlayerStats]);

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
    teamStats,
    unresolvableTiles,
    pendingScreenshots,
    health,
    healthError,
    conflicts,
    conflictsError,
    loading,
    error,
    permissionDenied,
    isActive,
    isComplete,
    isPlanned,
    latestPendingCount,
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
