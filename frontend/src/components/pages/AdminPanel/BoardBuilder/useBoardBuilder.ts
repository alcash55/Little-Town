import { useState } from 'react';

interface Tile {
  type: string;
  task: string;
  points: number;
}

export const useBoardBuilder = () => {
  const [tileType, setTileType] = useState<string>('');
  const [tileTask, setTileTask] = useState<string>('');
  const [tilePoints, setTilePoints] = useState<number>(0);
  const [tileWeight, setTileWeight] = useState<number>(0);
  const [board, setBoard] = useState<Tile[]>([]);

  const tilesTypeOptions = [
    { name: 'Kill Count', value: 1 },
    { name: 'Experience', value: 2 },
    { name: 'Drops', value: 3 },
  ];

  /**
   * Adds a tile to the board, adds tiles points with weight
   * and updates the board state. Then resets the tile states
   */
  const addTile = () => {
    const newBoard = [...board];
    newBoard.push({ type: tileType, task: tileTask, points: tilePoints + tileWeight });
    setBoard(newBoard);

    setTileType('');
    setTileTask('');
    setTilePoints(0);
    setTileWeight(0);
  };

  const submitBoard = () => {};

  return {
    tilesTypeOptions,
    tileType,
    setTileType,
    tileTask,
    setTileTask,
    tilePoints,
    setTilePoints,
    tileWeight,
    setTileWeight,
    addTile,
    board,
  };
};
