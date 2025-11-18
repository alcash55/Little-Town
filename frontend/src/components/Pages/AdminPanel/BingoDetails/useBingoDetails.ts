import { useState } from 'react';

type Bingo = {
  name: string;
  start: string;
  end: string;
  size: number;
  numberOfTeams: number;
  teams: string[];
};

export const useBingoDetails = () => {
  const BASEURL = import.meta.env.VITE_BASEURL ?? 'http://localhost:3000';
  const token = localStorage.getItem('authToken');

  const [bingoName, setBingoName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [boardSize, setBoardSize] = useState(16);
  const [numberOfTeams, setNumberOfTeams] = useState<number>(3);
  const [teamNames, setTeamNames] = useState<string[]>([]);

  /**
   * Submit the bingo details
   * @param details
   */
  const planBingo = async (details: Bingo) => {
    try {
      const response = await fetch(`${BASEURL}/api/admin/bingo/details`, {
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
  };
};
