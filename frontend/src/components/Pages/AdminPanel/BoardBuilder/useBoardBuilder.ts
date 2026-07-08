import { useEffect, useState, useCallback } from 'react';
import { getActivities } from '../../../../utils/getActivities';
import { getSkills } from '../../../../utils/getSkills';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { cachedFetch } from '../../../../utils/cachedFetch';

export type Tile =
  | { type: 'Kill Count'; task: string; points: number; killCount: number }
  | { type: 'Experience'; task: string; points: number; experience: number }
  | { type: 'Drops'; task: string; points: number; dropsAmount: number };

export type EditingTile = {
  index: number;
  tile: Tile;
};

export const useBoardBuilder = () => {
  const BASEURL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

  const tilesTypeOptions = [
    { name: 'Kill Count', value: 1 },
    { name: 'Experience', value: 2 },
    { name: 'Drops', value: 3 },
  ];

  // Form state
  const [tileType, setTileType] = useState<(typeof tilesTypeOptions)[0]>(tilesTypeOptions[0]);
  const [tileTask, setTileTask] = useState('');
  const [tilePoints, setTilePoints] = useState<number | undefined>();
  const [tileKillCount, setTileKillCount] = useState<number | undefined>();
  const [tileExperience, setTileExperience] = useState<number | undefined>();
  const [tileDropsAmount, setTileDropsAmount] = useState<number | undefined>();

  // Data state
  const [activities, setActivities] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<Tile[]>([]);
  const [boardSize, setBoardSize] = useState<number>(16);
  const [boardFromBackend, setBoardFromBackend] = useState(false);

  // UI state
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingTile, setEditingTile] = useState<EditingTile | null>(null);

  // Derived
  const isExistingBoard = boardFromBackend;
  const isBoardComplete = board.length === boardSize;
  const isTileValid =
    !!tileTask &&
    tilePoints !== undefined &&
    (tileType.name === 'Kill Count'
      ? tileKillCount !== undefined
      : tileType.name === 'Experience'
      ? tileExperience !== undefined
      : tileDropsAmount !== undefined);

  /**
   * Fetch all items in osrs
   * @returns 
   */
  const getItemMappings = (): Promise<string[]> =>
    cachedFetch('osrs:items', async () => {
      const res = await fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', {
        headers: { 'User-Agent': 'https://littletown.gay/' },
      });
      if (!res.ok) throw new Error(`Failed to fetch items: ${res.status}`);
      const data = await res.json();
      return data.map((d: any) => d.name);
    });

  // On mount: fetch existing board from backend, fallback to localStorage, load autocomplete data
  useEffect(() => {
    const loadBoard = async () => {
      const token = localStorage.getItem('authToken');

      if (token) {
        try {
          // Fetch active bingo to get board size
          const bingoRes = await fetchWithAuth(`${BASEURL}/bingo/details`);
          if (bingoRes.ok) {
            const bingoJson = await bingoRes.json();
            if (bingoJson.data?.boardSize) setBoardSize(bingoJson.data.boardSize);
          }

          // Fetch existing board from backend
          const boardRes = await fetchWithAuth(`${BASEURL}/bingo/board`);
          if (boardRes.ok) {
            const contentType = boardRes.headers.get('content-type') ?? '';
            if (contentType.includes('application/json')) {
              const boardJson = await boardRes.json();
              if (Array.isArray(boardJson.data) && boardJson.data.length > 0) {
                setBoard(boardJson.data);
                setBoardFromBackend(true);
                localStorage.setItem('bingoBoard', JSON.stringify(boardJson.data));
                return;
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch board from backend, falling back to localStorage:', e);
        }
      }

      // Fallback to localStorage for unsaved board
      const saved = localStorage.getItem('bingoBoard');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setBoard(parsed);
        } catch (e) {
          console.error('Failed to parse saved board:', e);
        }
      }
    };

    loadBoard();

    // Load each independently so one failure doesn't block the others
    getActivities()
      .then(setActivities)
      .catch((e) => console.error('Failed to load activities:', e?.message ?? e));

    getSkills()
      .then(setSkills)
      .catch((e) => console.error('Failed to load skills:', e?.message ?? e));

    getItemMappings()
      .then(setItems)
      .catch((e) => console.error('Failed to load items:', e?.message ?? e))
      .finally(() => setLoading(false));
  }, []);

  /**
   * Add a single tile to the board
   */
  const addTile = () => {
    if (!isTileValid) return;

    let tileToAdd: Tile;

    if (tileType.name === 'Kill Count') {
      tileToAdd = {
        type: 'Kill Count',
        task: tileTask,
        points: tilePoints!,
        killCount: tileKillCount!,
      };
    } else if (tileType.name === 'Experience') {
      tileToAdd = {
        type: 'Experience',
        task: tileTask,
        points: tilePoints!,
        experience: tileExperience!,
      };
    } else {
      tileToAdd = {
        type: 'Drops',
        task: tileTask,
        points: tilePoints!,
        dropsAmount: tileDropsAmount!,
      };
    }

    setBoard((prev) => {
      const updated = [...prev, tileToAdd];
      localStorage.setItem('bingoBoard', JSON.stringify(updated));
      return updated;
    });

    clearTileForm();
  };

  const removeTile = (tileToRemove: Tile) => {
    const idx = board.indexOf(tileToRemove);
    if (idx === -1) return;
    const updated = board.filter((_, i) => i !== idx);
    localStorage.setItem('bingoBoard', JSON.stringify(updated));
    setBoard(updated);
  };

  const reorderTiles = useCallback((oldIndex: number, newIndex: number) => {
    setBoard((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);
      localStorage.setItem('bingoBoard', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const startEditingTile = (index: number) => {
    setEditingTile({ index, tile: { ...board[index] } as Tile });
  };

  const updateEditingTile = (fields: Partial<Tile>) => {
    if (!editingTile) return;
    setEditingTile({ ...editingTile, tile: { ...editingTile.tile, ...fields } as Tile });
  };

  const saveEditingTile = () => {
    if (!editingTile) return;
    setBoard((prev) => {
      const updated = [...prev];
      updated[editingTile.index] = editingTile.tile;
      localStorage.setItem('bingoBoard', JSON.stringify(updated));
      return updated;
    });
    setEditingTile(null);
  };

  const cancelEditingTile = () => setEditingTile(null);

  // Clears only the current tile form inputs, not the whole board
  const clearTileForm = () => {
    setTileTask('');
    setTilePoints(undefined);
    setTileKillCount(undefined);
    setTileExperience(undefined);
    setTileDropsAmount(undefined);
    setTileType(tilesTypeOptions[0]);
  };

  // Clears the entire board
  const clearBoard = () => {
    clearTileForm();
    setBoard([]);
    setBoardFromBackend(false);
    setSubmitted(false);
    setSubmitError(null);
    localStorage.removeItem('bingoBoard');
  };

  const submitBoard = async () => {
    setSubmitError(null);
    try {
      const method = isExistingBoard ? 'PUT' : 'POST';
      const response = await fetchWithAuth(`${BASEURL}/bingo/board`, {
        method,
        body: JSON.stringify(board),
      });

      if (response.ok) {
        setSubmitted(true);
        localStorage.removeItem('bingoBoard');
      } else {
        const json = await response.json().catch(() => ({}));
        setSubmitError(json.error ?? `Failed to save board: ${response.statusText}`);
      }
    } catch (e) {
      setSubmitError('An unexpected error occurred. Please try again.');
      console.error(`Unable to save board: ${e}`);
    }
  };

  return {
    // Tile type options
    tilesTypeOptions,
    // Form state
    tileType,
    setTileType,
    tileTask,
    setTileTask,
    tilePoints,
    setTilePoints,
    tileKillCount,
    setTileKillCount,
    tileExperience,
    setTileExperience,
    tileDropsAmount,
    setTileDropsAmount,
    // Data
    activities,
    skills,
    items,
    loading,
    // Board
    board,
    boardSize,
    // UI state
    submitted,
    setSubmitted,
    submitError,
    // Derived
    isTileValid,
    isBoardComplete,
    isExistingBoard,
    // Handlers
    addTile,
    removeTile,
    reorderTiles,
    editingTile,
    startEditingTile,
    updateEditingTile,
    saveEditingTile,
    cancelEditingTile,
    clearTileForm,
    clearBoard,
    submitBoard,
  };
};
