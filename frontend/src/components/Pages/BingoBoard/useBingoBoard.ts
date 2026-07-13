import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../../utils/fetchWithAuth';

const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/bingo`;

// TEAM-BRIEF.md Sprint 7, Track A item 1 (frozen contract): GET /api/bingo/board
// -> bare object (not the usual ApiResponse envelope), authed at the same
// level as the other bingo read endpoints (`protect`, no admin/moderator
// requirement):
//
//   { active: false }
//   { active: true, bingo: {id,name,boardSize}, myTeam: {id,name}|null,
//     tiles: [{id,task,completedByMyTeam}] }
//
// `active` reflects `bingo.status === 'active'` specifically (a draft bingo
// reports `active: false` too, per Track A's report). `completedByMyTeam` is
// only ever the caller's own team's approved-submission state — a caller
// with no team gets `myTeam: null` and every tile `completedByMyTeam: false`.
export interface BingoBoardTile {
  id: string;
  task: string;
  completedByMyTeam: boolean;
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

export type BingoBoardState =
  | { active: false }
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
