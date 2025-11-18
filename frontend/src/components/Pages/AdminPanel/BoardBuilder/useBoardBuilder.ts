import { useEffect, useState } from 'react';
import { getActivities } from '../../../../utils/getActivities';
import { getSkills } from '../../../../utils/getSkills';

type Tile =
  | {
      type: 'Kill Count';
      task: string;
      points: number;
      killCount: number;
    }
  | {
      type: 'Experience';
      task: string;
      points: number;
      experience: number;
    }
  | {
      type: 'Drops';
      task: string;
      points: number;
      dropsAmount: number;
    };

export const useBoardBuilder = () => {
  const BASEURL = import.meta.env.VITE_BASEURL ?? 'http://localhost:3000';
  const token = localStorage.getItem('authToken');

  const tilesTypeOptions = [
    { name: 'Kill Count', value: 1 },
    { name: 'Experience', value: 2 },
    { name: 'Drops', value: 3 },
  ];

  const [tileType, setTileType] = useState<(typeof tilesTypeOptions)[0]>(tilesTypeOptions[0]);
  const [tileTask, setTileTask] = useState<string>('');
  const [tilePoints, setTilePoints] = useState<number | undefined>();

  const [tileKillCount, setTileKillCount] = useState<number | undefined>();
  const [tileExperience, setTileExperience] = useState<number | undefined>();
  const [tileDropsAmount, setTileDropsAmount] = useState<number | undefined>();

  const [activities, setActivities] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [options, setOptions] = useState<string[]>([]);

  const [board, setBoard] = useState<Tile[]>([]);

  // If there is a pre-existing board, load it & fetch skills, activities, and items
  useEffect(() => {
    // Load saved board
    const saved = localStorage.getItem('bingoBoard');
    if (saved) {
      try {
        console.log('loading board', JSON.parse(saved));
        setBoard(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse board:', e);
        setBoard([]);
      }
    }

    Promise.all([getActivities(), getSkills(), getItemMappings()])
      .then(([acts, skls, itm]) => {
        setActivities(acts);
        setSkills(skls);
        setItems(itm);
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Fetch all items from OSRS API
   * @returns Promise<string[]>
   */
  const getItemMappings = async (): Promise<string[]> => {
    const url = 'https://prices.runescape.wiki/api/v1/osrs/mapping';

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'https://littletown.gay/',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch items: ${res.status}`);
    }

    const data = await res.json();

    const items: string[] = data.map((d: any) => d.name);

    return items;
  };

  /**
   * Add a tile to the bingo board
   * @returns void
   */
  const addTile = () => {
    if (!tileTask || tilePoints === undefined) {
      console.error('Missing task or points');
      return;
    }

    let tileToAdd: Tile | null = null;

    // Kill Count tile
    if (tileType.name === tilesTypeOptions[0].name) {
      if (tileKillCount === undefined) {
        console.error('Missing kill count');
        return;
      }

      tileToAdd = {
        type: 'Kill Count',
        task: tileTask,
        points: tilePoints,
        killCount: tileKillCount,
      };
    }

    // Experience tile
    else if (tileType.name === tilesTypeOptions[1].name) {
      if (tileExperience === undefined) {
        console.error('Missing experience amount');
        return;
      }

      tileToAdd = {
        type: 'Experience',
        task: tileTask,
        points: tilePoints,
        experience: tileExperience,
      };
    }

    // Drops tile
    else {
      if (tileDropsAmount === undefined) {
        console.error('Missing drop info');
        return;
      }

      tileToAdd = {
        type: 'Drops',
        task: tileTask,
        points: tilePoints,
        dropsAmount: tileDropsAmount,
      };
    }

    // Add to board + save
    setBoard((prev) => {
      const updated = [...prev, tileToAdd!];
      console.log('updating board in local storage');
      localStorage.setItem('bingoBoard', JSON.stringify(updated));
      return updated;
    });

    // Reset tile for next tile to be added
    clear();
  };

  /**
   * Reset the bingo board
   */
  const clear = () => {
    setTileTask('');
    setTilePoints(undefined);
    setTileKillCount(undefined);
    setTileExperience(undefined);
    setTileDropsAmount(undefined);
    setTileType(tilesTypeOptions[0]);

    localStorage.setItem('bingoBoard', '');
  };

  /**-
   * Tile to remove from the board
   * @param tileToRemove
   */
  const removeTile = (tileToRemove: Tile) => {
    const newBoard = board.filter((tile) => tile.task !== tileToRemove.task);
    localStorage.setItem('bingoBoard', JSON.stringify(newBoard));
    setBoard(newBoard);
  };

  // TODO add verification of the board based on tbe bingo details
  const submitBoard = async () => {
    try {
      const response = await fetch(`${BASEURL}/api/admin/bingo/board`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(board),
      });

      if (response.ok) {
        console.log('bingo board successfully created');
        // board is created, reset the form
        clear();
      } else {
        throw new Error(`Failed to create bingo board: ${response.statusText}`);
      }
    } catch (e) {
      console.error(`Unable to create board: ${e}`);
    }
  };

  return {
    tilesTypeOptions,
    tileType,
    setTileType,
    tileTask,
    setTileTask,
    tilePoints,
    setTilePoints,
    addTile,
    board,
    clear,
    removeTile,
    submitBoard,
    tileKillCount,
    setTileKillCount,
    tileExperience,
    setTileExperience,
    tileDropsAmount,
    setTileDropsAmount,
    activities,
    skills,
    items,
    options,
    setOptions,
    loading,
  };
};
