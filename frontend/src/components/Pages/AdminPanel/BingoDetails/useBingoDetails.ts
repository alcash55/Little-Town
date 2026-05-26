import { useState } from 'react';

type Bingo = {
  name: string;
  start: string;
  end: string;
  size: number;
  numberOfTeams: number;
  teams: string[];
};

export type BingoConfig = {
  id?: string;
  name: string;
  description?: string;
  status?: string;
  startDate: string;
  endDate: string;
  boardSize: number;
  numberOfTeams?: number;
  teams: string[];
  tasks: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const useBingoDetails = () => {
  const BASEURL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

  const [bingoName, setBingoName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [boardSize, setBoardSize] = useState(16);
  const [numberOfTeams, setNumberOfTeams] = useState<number>(3);
  const [teamNames, setTeamNames] = useState<string[]>([]);

  const token = localStorage.getItem('authToken');

  /**
   * Submit the bingo details
   */
  const planBingo = async (details: Bingo) => {
    try {
      const response = await fetch(`${BASEURL}/bingo/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(details),
      });

      if (response.ok) {
        console.log('details successfully sent');
      } else {
        throw new Error(`Failed to send bingo details: ${response.statusText}`);
      }
    } catch (e) {
      console.error(`Unable to send details: ${e}`);
    }
  };

  /**
   * Fetch existing bingo — returns BingoConfig if one exists, null otherwise
   */
  const existingBingo = async (): Promise<BingoConfig | null> => {
    try {
      const response = await fetch(`${BASEURL}/bingo/details`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) return null;

      const json = await response.json();
      return json.data ?? null;
    } catch (e) {
      console.error(`Unable to get existing Bingo: ${e}`);
      return null;
    }
  };

  /**
   * Update existing bingo details — fetches the active bingo id automatically
   */
  const modifyBingo = async (details: Partial<Bingo>) => {
    try {
      const current = await existingBingo();
      if (!current?.id) {
        console.error('No active bingo found to modify');
        return;
      }

      const response = await fetch(`${BASEURL}/bingo/${current.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(details),
      });

      if (response.ok) {
        console.log('updated details successfully sent');
      } else {
        throw new Error(`Failed to modify bingo details: ${response.statusText}`);
      }
    } catch (e) {
      console.error(`Unable to update details: ${e}`);
    }
  };

  /**
   * Reset the form
   */
  const clearBingo = () => {
    setBingoName('');
    setStartDate('');
    setEndDate('');
    setBoardSize(16);
    setNumberOfTeams(3);
    setTeamNames([]);
  };

  return {
    bingoName,
    setBingoName,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    boardSize,
    setBoardSize,
    numberOfTeams,
    setNumberOfTeams,
    teamNames,
    setTeamNames,
    planBingo,
    clearBingo,
    existingBingo,
    modifyBingo,
  };
};
