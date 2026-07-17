import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/bingo`;

// TEAM-BRIEF.md Sprint 7, Track A item 1 (frozen contract), EXTENDED
// additively in Sprint 8, Track A item 4 and Sprint 13, Track A item 1:
// GET /api/bingo/board -> bare object (not the usual ApiResponse envelope),
// authed at the same level as the other bingo read endpoints (`protect`, no
// admin/moderator requirement):
//
//   { active: false }
//   { active: true, bingo: {id,name,boardSize}, myTeam: {id,name}|null,
//     tiles: [{id,task,completedByMyTeam,pendingByMyTeam,type,points,targetValue}] }
//
// `active` reflects `bingo.status === 'active'` specifically (a draft bingo
// reports `active: false` too, per Track A's report). `completedByMyTeam` is
// only ever the caller's own team's completion state — per Sprint 13's model
// this now means EITHER auto-verified from the hiscores (Kill Count/
// Experience tiles) OR an approved Drops screenshot for that team (deduped
// server-side). A caller with no team gets `myTeam: null` and every tile
// `completedByMyTeam`/`pendingByMyTeam`: false.
//
// `type`/`points`/`targetValue` (Sprint 8, Track A item 4) are additive —
// they were already selected server-side for other bingo endpoints, this
// just exposes them here too, for the tile art/points UI. `targetValue` is
// nullable (not every tile literal sets one).
//
// `pendingByMyTeam` (Sprint 13, Track A item 1 / Track B item 1): true when
// a Drops-tile screenshot submission for the caller's own team is awaiting
// admin review — drives the board's yellow "pending" tile treatment (see
// BingoTile.tsx). KC/XP tiles never carry this (no screenshot flow for
// them). Track A has shipped the field server-side (see routes/bingo.ts's
// `/board` handler) — this is the real wire contract now, not a mock. See
// BingoTile.test.tsx for coverage of the resulting tile states (exercising
// BingoTile directly with the flag set by hand, since this hook has no
// dedicated test file yet).
export interface BingoBoardTile {
  id: string;
  task: string;
  completedByMyTeam: boolean;
  pendingByMyTeam: boolean;
  type: 'Kill Count' | 'Experience' | 'Drops';
  points: number;
  targetValue: number | null;
}

export interface BingoBoardInfo {
  id: string;
  name: string;
  boardSize: number;
}

export interface BingoBoardTeam {
  id: string;
  name: string;
}

// TEAM-BRIEF.md Sprint 15, Track A item 4 (frozen contract): when no bingo is
// active but the most recent one is status='complete', GET /api/bingo/board
// additively returns `{ active: false, ended: { name, endDate } }` instead
// of the bare `{ active: false }` it always used to — anonymous-safe
// (name+endDate only, no team data), so the public board can say "the bingo
// has ended" instead of implying none ever existed. Optional: a caller on
// today's pre-Sprint-15 backend, or a genuine "no bingo has ever run" case,
// still gets the bare shape (no `ended` key).
export interface BingoBoardEnded {
  name: string;
  endDate: string;
}

export type BingoBoardState =
  | { active: false; ended?: BingoBoardEnded }
  | {
      active: true;
      bingo: BingoBoardInfo;
      myTeam: BingoBoardTeam | null;
      tiles: BingoBoardTile[];
    };

export const useBingoBoard = () => {
  const [board, setBoard] = useState<BingoBoardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${BASE_URL}/board`);
      if (!res.ok) {
        throw new Error(`Failed to load the bingo board (${res.status}).`);
      }
      const json: BingoBoardState = await res.json();
      setBoard(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the bingo board.');
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  return { board, loading, error, refetch: fetchBoard };
};
