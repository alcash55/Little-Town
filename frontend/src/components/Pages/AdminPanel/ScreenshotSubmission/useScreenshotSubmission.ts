import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { BingoTeam } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

/**
 * A board tile as returned by GET /bingo/board, extended with the underlying
 * bingo_board_tiles row id.
 *
 * CONTRACT NOTE: as of this writing, getActiveBingoBoard() in
 * backend/src/db/bingos.ts only selects `metadata` (task/type/points/etc.),
 * not `id` — so `id` will be undefined until that query is extended to also
 * select the tile's id. The tile picker below only offers tiles that have an
 * id, so it degrades to "no tiles available" rather than ever submitting a
 * fabricated tileId.
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

type ReviewAction = 'approve' | 'deny';

const omitKey = <T,>(map: Record<string, T>, key: string): Record<string, T> => {
  const next = { ...map };
  delete next[key];
  return next;
};

export const useScreenshotSubmission = () => {
  const [pending, setPending] = useState<PendingScreenshotSubmission[]>([]);
  const [board, setBoard] = useState<BoardTile[]>([]);
  const [teams, setTeams] = useState<BingoTeam[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Per-submission tile/team selections, keyed by submission id. */
  const [tileSelection, setTileSelection] = useState<Record<string, string>>({});
  const [teamSelection, setTeamSelection] = useState<Record<string, string>>({});

  /** In-flight approve/deny request, if any. */
  const [reviewing, setReviewing] = useState<{ id: string; action: ReviewAction } | null>(null);
  const [reviewError, setReviewError] = useState<Record<string, string>>({});

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
    } catch {
      /* non-fatal: tile/team pickers just stay empty */
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchPending(), fetchTeamsAndBoard()]);
      setLoading(false);
    };
    load();
  }, [fetchPending, fetchTeamsAndBoard]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchPending(), fetchTeamsAndBoard()]);
  }, [fetchPending, fetchTeamsAndBoard]);

  const setTileForSubmission = useCallback((submissionId: string, tileId: string) => {
    setTileSelection((prev) => ({ ...prev, [submissionId]: tileId }));
  }, []);

  const setTeamForSubmission = useCallback((submissionId: string, teamId: string) => {
    setTeamSelection((prev) => ({ ...prev, [submissionId]: teamId }));
  }, []);

  const review = useCallback(
    async (submissionId: string, action: ReviewAction) => {
      setReviewing({ id: submissionId, action });
      setReviewError((prev) => omitKey(prev, submissionId));

      try {
        const body =
          action === 'approve'
            ? { tileId: tileSelection[submissionId], teamId: teamSelection[submissionId] }
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
      } catch (e) {
        setReviewError((prev) => ({
          ...prev,
          [submissionId]: e instanceof Error ? e.message : `Failed to ${action} screenshot.`,
        }));
      } finally {
        setReviewing(null);
      }
    },
    [tileSelection, teamSelection],
  );

  const approve = useCallback((submissionId: string) => review(submissionId, 'approve'), [review]);
  const deny = useCallback((submissionId: string) => review(submissionId, 'deny'), [review]);

  /** Tiles that actually carry an id — the only ones safe to offer in the picker. */
  const tileOptions = useMemo(
    () => board.filter((t): t is BoardTile & { id: string } => !!t.id),
    [board],
  );

  return {
    pending,
    teams,
    tileOptions,
    boardMissingTileIds: board.length > 0 && tileOptions.length === 0,
    loading,
    error,
    refresh,

    tileSelection,
    teamSelection,
    setTileForSubmission,
    setTeamForSubmission,

    reviewing,
    reviewError,
    approve,
    deny,
  };
};
