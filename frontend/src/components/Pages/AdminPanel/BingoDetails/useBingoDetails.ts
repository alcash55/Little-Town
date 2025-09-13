import { useState } from 'react';

export const useBingoDetails = () => {
  const [bingoName, setBingoName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [boardSize, setBoardSize] = useState(16);
  const [numberOfTeams, setNumberOfTeams] = useState(3);
  const [teamNames, setTeamNames] = useState(['', '', '', '']);


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
  };
};
