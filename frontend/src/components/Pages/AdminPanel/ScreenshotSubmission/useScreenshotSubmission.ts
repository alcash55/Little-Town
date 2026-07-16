import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { BingoPlayer, BingoTeam } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

/** Auto-poll interval for pending screenshots, per TEAM-BRIEF contract 6. */
const POLL_INTERVAL_MS = 45_000;

/**
 * GET /bingo/players (see BingoOverview/useBingoOverview.ts) returns rows
 * shaped `{ player: BingoPlayer, start, current, sideAccounts }`. Only the
 * `player` field is needed here.
 */
type PlayersResponseRow = { player: BingoPlayer };

/**
 * A board tile as returned by GET /bingo/board, extended with the underlying
 * bingo_board_tiles row id.
 *
 * getActiveBingoBoard() in backend/src/db/bingos.ts selects `id, metadata`
 * and maps the row id onto each tile, so `id` is populated in practice. The
 * tile picker below still only offers tiles that have an id, as a safety net
 * against ever submitting a fabricated tileId.
 */
export type BoardTile = Tile & { id?: string };

/**
 * Shape of one row from GET /bingo/screenshots/pending.
 *
 * CONTRACT NOTE: the brief specifies this endpoint returns "pending
 * submissions with a short-lived signed image URL each" but does not pin
 * down exact field names. Field names below follow this codebase's existing
 * camelCase API convention (see BingoConfig/BingoTeam) and are a best-effort
 * match against the bingo_submissions columns added in
 * 20260708000000_screenshot_submissions.sql (id, image_path -> imageUrl,
 * submitted_by/rsn -> submittedBy, created_at -> submittedAt,
 * discord_message_id -> discordMessageId). Verify against the real backend
 * response and adjust field names here if they differ.
 */
export type PendingScreenshotSubmission = {
  id: string;
  imageUrl: string | null;
  submittedBy: string;
  submittedAt: string;
  discordMessageId?: string;
};

/**
 * Shape of one row from GET /bingo/screenshots/unattributed — the backfill
 * worklist for the attribution gap (bug-report investigation, H1): approved
 * submissions with no player_id. Already counted at the team level (GET
 * /bingo/team-stats), just missing a per-player link.
 */
export type UnattributedSubmission = {
  id: string;
  tileId: string | null;
  tileTask: string | null;
  teamId: string | null;
  teamName: string | null;
  submittedBy: string;
  approvedAt: string | null;
  imageUrl: string | null;
};

type ReviewAction = 'approve' | 'deny';

const omitKey = <T,>(map: Record<string, T>, key: string): Record<string, T> => {
  const next = { ...map };
  delete next[key];
  return next;
};

export const useScreenshotSubmission = () => {
  const [pending, setPending] = useState<PendingScreenshotSubmission[]>([]);
  const [unattributed, setUnattributed] = useState<UnattributedSubmission[]>([]);
  const [board, setBoard] = useState<BoardTile[]>([]);
  const [teams, setTeams] = useState<BingoTeam[]>([]);
  const [players, setPlayers] = useState<BingoPlayer[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Non-fatal: fetchTeamsAndBoard failures, surfaced as a dismissible Alert
   * distinct from the fatal page-level `error` above. */
  const [teamsBoardError, setTeamsBoardError] = useState<string | null>(null);

  /** Per-submission tile/team/player selections, keyed by submission id. */
  const [tileSelection, setTileSelection] = useState<Record<string, string>>({});
  const [teamSelection, setTeamSelection] = useState<Record<string, string>>({});
  const [playerSelection, setPlayerSelection] = useState<Record<string, string>>({});

  /** In-flight approve/deny request, if any. */
  const [reviewing, setReviewing] = useState<{ id: string; action: ReviewAction } | null>(null);
  const [reviewError, setReviewError] = useState<Record<string, string>>({});

  /** Per-unattributed-submission player selection (attribution backfill, H1). */
  const [attributionSelection, setAttributionSelection] = useState<Record<string, string>>({});
  const [attributing, setAttributing] = useState<string | null>(null);
  const [attributionError, setAttributionError] = useState<Record<string, string>>({});

  /** Guards `refresh` against overlapping calls without depending on render state. */
  const refreshingRef = useRef(false);
  /** Mirrors `reviewing` for the poll loop, so the interval isn't rebuilt on every review. */
  const reviewingRef = useRef<{ id: string; action: ReviewAction } | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/screenshots/pending`);
      if (!res.ok) throw new Error(`Failed to load pending screenshots: ${res.statusText}`);
      const json = await res.json();
      setPending(Array.isArray(json.data) ? json.data : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending screenshots.');
    }
  }, []);

  const fetchUnattributed = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/screenshots/unattributed`);
      if (!res.ok) return; // non-fatal: the section just stays at its last-known rows
      const json = await res.json();
      setUnattributed(Array.isArray(json.data) ? json.data : []);
    } catch {
      /* non-fatal */
    }
  }, []);

  const fetchTeamsAndBoard = useCallback(async () => {
    try {
      const [detailsRes, boardRes] = await Promise.all([
        fetchWithAuth(`${BASE_URL}/bingo/details`),
        fetchWithAuth(`${BASE_URL}/bingo/board`),
      ]);
      if (detailsRes.ok) {
        const json = await detailsRes.json();
        const teamObjects: BingoTeam[] = json.data?.teamObjects ?? [];
        setTeams([...teamObjects].sort((a, b) => a.sortOrder - b.sortOrder));
      }
      if (boardRes.ok) {
        const json = await boardRes.json();
        setBoard(Array.isArray(json.data) ? json.data : []);
      }
      if (!detailsRes.ok && !boardRes.ok) {
        throw new Error('Failed to load teams and board.');
      }
      setTeamsBoardError(null);
    } catch (e) {
      // Tile/team pickers just stay at their last-known values; this is
      // surfaced as a dismissible Alert, not the fatal page error.
      setTeamsBoardError(e instanceof Error ? e.message : 'Failed to load teams and board.');
    }
  }, []);

  /** Fetched once on mount, per Story 3a — the player picker's option list
   * doesn't need to track the 45s poll or manual refresh. */
  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BASE_URL}/bingo/players`);
      if (!res.ok) return;
      const json = await res.json();
      const rows: PlayersResponseRow[] = Array.isArray(json.data) ? json.data : [];
      setPlayers(rows.map((row) => row.player));
    } catch {
      /* non-fatal: player picker just stays empty */
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchPending(), fetchUnattributed(), fetchTeamsAndBoard(), fetchPlayers()]);
      setLoading(false);
    };
    load();
  }, [fetchPending, fetchUnattributed, fetchTeamsAndBoard, fetchPlayers]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([fetchPending(), fetchUnattributed(), fetchTeamsAndBoard()]);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [fetchPending, fetchUnattributed, fetchTeamsAndBoard]);

  useEffect(() => {
    reviewingRef.current = reviewing;
  }, [reviewing]);

  // Auto-poll pending screenshots per TEAM-BRIEF contract 6: 45s interval,
  // paused while a review is in flight, a manual refresh is already running,
  // or the tab is hidden. Cleaned up on unmount.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (reviewingRef.current) return;
      if (refreshingRef.current) return;
      fetchPending();
      fetchUnattributed();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPending, fetchUnattributed]);

  const dismissTeamsBoardError = useCallback(() => setTeamsBoardError(null), []);

  const setTileForSubmission = useCallback((submissionId: string, tileId: string) => {
    setTileSelection((prev) => ({ ...prev, [submissionId]: tileId }));
  }, []);

  const setTeamForSubmission = useCallback((submissionId: string, teamId: string) => {
    setTeamSelection((prev) => ({ ...prev, [submissionId]: teamId }));
    // The player picker's options depend on the selected team, so a prior
    // player choice from a different team is no longer valid.
    setPlayerSelection((prev) => omitKey(prev, submissionId));
  }, []);

  const setPlayerForSubmission = useCallback((submissionId: string, playerId: string) => {
    setPlayerSelection((prev) => ({ ...prev, [submissionId]: playerId }));
  }, []);

  const review = useCallback(
    async (submissionId: string, action: ReviewAction) => {
      setReviewing({ id: submissionId, action });
      setReviewError((prev) => omitKey(prev, submissionId));

      try {
        const playerId = playerSelection[submissionId];
        const body =
          action === 'approve'
            ? {
                tileId: tileSelection[submissionId],
                teamId: teamSelection[submissionId],
                ...(playerId ? { playerId } : {}),
              }
            : {};

        const res = await fetchWithAuth(
          `${BASE_URL}/bingo/screenshots/${submissionId}/${action}`,
          { method: 'POST', body: JSON.stringify(body) },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? res.statusText);
        }

        setPending((prev) => prev.filter((p) => p.id !== submissionId));
        setTileSelection((prev) => omitKey(prev, submissionId));
        setTeamSelection((prev) => omitKey(prev, submissionId));
        setPlayerSelection((prev) => omitKey(prev, submissionId));
      } catch (e) {
        setReviewError((prev) => ({
          ...prev,
          [submissionId]: e instanceof Error ? e.message : `Failed to ${action} screenshot.`,
        }));
      } finally {
        setReviewing(null);
      }
    },
    [tileSelection, teamSelection, playerSelection],
  );

  const approve = useCallback((submissionId: string) => review(submissionId, 'approve'), [review]);
  const deny = useCallback((submissionId: string) => review(submissionId, 'deny'), [review]);
  const dismissReviewError = useCallback((submissionId: string) => {
    setReviewError((prev) => omitKey(prev, submissionId));
  }, []);

  const setPlayerForAttribution = useCallback((submissionId: string, playerId: string) => {
    setAttributionSelection((prev) => ({ ...prev, [submissionId]: playerId }));
  }, []);

  const dismissAttributionError = useCallback((submissionId: string) => {
    setAttributionError((prev) => omitKey(prev, submissionId));
  }, []);

  /** Backfill path for H1 (bug-report investigation): fills in player_id on
   * an already-approved submission via PATCH .../attribute. */
  const attribute = useCallback(
    async (submissionId: string) => {
      const playerId = attributionSelection[submissionId];
      if (!playerId) return;

      setAttributing(submissionId);
      setAttributionError((prev) => omitKey(prev, submissionId));

      try {
        const res = await fetchWithAuth(
          `${BASE_URL}/bingo/screenshots/${submissionId}/attribute`,
          { method: 'PATCH', body: JSON.stringify({ playerId }) },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? res.statusText);
        }
        setUnattributed((prev) => prev.filter((s) => s.id !== submissionId));
        setAttributionSelection((prev) => omitKey(prev, submissionId));
      } catch (e) {
        setAttributionError((prev) => ({
          ...prev,
          [submissionId]: e instanceof Error ? e.message : 'Failed to attribute submission.',
        }));
      } finally {
        setAttributing(null);
      }
    },
    [attributionSelection],
  );

  /** Tiles that actually carry an id — the only ones safe to offer in the picker. */
  const tileOptions = useMemo(
    () => board.filter((t): t is BoardTile & { id: string } => !!t.id),
    [board],
  );

  return {
    pending,
    unattributed,
    teams,
    players,
    tileOptions,
    boardMissingTileIds: board.length > 0 && tileOptions.length === 0,
    loading,
    refreshing,
    error,
    refresh,

    attributionSelection,
    setPlayerForAttribution,
    attributing,
    attributionError,
    dismissAttributionError,
    attribute,

    teamsBoardError,
    dismissTeamsBoardError,

    tileSelection,
    teamSelection,
    playerSelection,
    setTileForSubmission,
    setTeamForSubmission,
    setPlayerForSubmission,

    reviewing,
    reviewError,
    dismissReviewError,
    approve,
    deny,
  };
};
