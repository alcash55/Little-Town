import { useState } from 'react';

type Tile = {
  type: 'Kill Count' | 'Experience' | 'Drops';
  task: string;
  points: number;
  objective?: string | number;
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

  const [board, setBoard] = useState<Tile[]>([]);

  /**
   * Adds a tile to the board, adds tiles points with weight
   * and updates the board state. Then resets the tile states
   */
  const addTile = () => {
    const newBoard = [...board];
    if (!tileTask || !tilePoints) {
      console.log('no tile');
      return;
    }

    let objective: string | number | undefined;
    if (tileType.name === 'Kill Count') {
      objective = tileKillCount;
    } else if (tileType.name === 'Experience') {
      objective = tileExperience;
    } else if (tileType.name === 'Drops') {
      objective = tileDrops;
    }

    newBoard.push({
      type: tileType.name as 'Kill Count' | 'Experience' | 'Drops',
      task: tileTask,
      points: tilePoints,
      objective,
    });

    setBoard(newBoard);

    // reset tile form fields
    setTileTask('');
    setTilePoints(undefined);

    setTileKillCount(undefined);
    setTileExperience(undefined);
    setTileDrops(undefined);
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
  };
};
