import { useState } from 'react';

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
      drops: string;
      dropsAmount: number;
    };

export const useBoardBuilder = () => {
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
  const [tileDrops, setTileDrops] = useState<string | undefined>();
  const [tileDropsAmount, setTileDropsAmount] = useState<number | undefined>();

  const [board, setBoard] = useState<Tile[]>([]);

  /**
   * Adds a tile to the board, adds tiles points with weight
   * and updates the board state. Then resets the tile states
   */
  const addTile = () => {
    if (!tileTask || !tilePoints) {
      console.log('Missing task or points');
      return;
    }

    let newTile: Tile | null = null;

    if (tileType.name === 'Kill Count') {
      if (tileKillCount === undefined) {
        console.log('Missing kill count');
        return;
      }

      newTile = {
        type: 'Kill Count',
        task: tileTask,
        points: tilePoints,
        killCount: tileKillCount,
      };
    } else if (tileType.name === 'Experience') {
      if (tileExperience === undefined) {
        console.log('Missing experience amount');
        return;
      }

      newTile = {
        type: 'Experience',
        task: tileTask,
        points: tilePoints,
        experience: tileExperience,
      };
    } else if (tileType.name === 'Drops') {
      if (!tileDrops || tileDropsAmount === undefined) {
        console.log('Missing drop name or amount');
        return;
      }

      newTile = {
        type: 'Drops',
        task: tileTask,
        points: tilePoints,
        drops: tileDrops,
        dropsAmount: tileDropsAmount,
      };
    }

    if (newTile) {
      setBoard((prev) => [...prev, newTile]);
    }

    // Reset tile form fields
    setTileTask('');
    setTilePoints(undefined);
    setTileKillCount(undefined);
    setTileExperience(undefined);
    setTileDrops(undefined);
    setTileDropsAmount(undefined);
    setTileType(tilesTypeOptions[0]);
  };

  /**
   * Tile to remove from the board
   * @param tileToRemove
   */
  const removeTile = (tileToRemove: Tile) => {
    const newBoard = board.filter((tile) => tile.task !== tileToRemove.task);
    setBoard(newBoard);
  };

  const submitBoard = () => {
    //add verification
    // send request to backend
    console.log('board: ', board);
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
    removeTile,
    submitBoard,
    tileKillCount,
    setTileKillCount,
    tileExperience,
    setTileExperience,
    tileDrops,
    setTileDrops,
    tileDropsAmount,
    setTileDropsAmount,
  };
};
