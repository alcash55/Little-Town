import { useEffect, useState } from 'react';
import { darkTheme } from '../../../../layout/Theme';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

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
  const BASE_URL = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin`;

  // Form state
  const [bingoName, setBingoName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [boardSize, setBoardSize] = useState(16);
  const [numberOfTeams, setNumberOfTeams] = useState<number>(3);
  const [teamNames, setTeamNames] = useState<string[]>([]);

  // UI state
  const [isBingo, setIsBingo] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Derived
  const isFormValid =
    teamNames.length > 0 &&
    numberOfTeams >= 2 &&
    numberOfTeams <= 5 &&
    endDate !== '' &&
    startDate !== '' &&
    bingoName !== '' &&
    (boardSize === 16 || boardSize === 35);

  const hasFormData = !!(teamNames.length || endDate || startDate || bingoName);

  // SX styles
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: darkTheme.palette.text.primary,
      backgroundColor: 'transparent',
      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'black' },
      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
      '& input': { backgroundColor: 'transparent' },
      '& input:-webkit-autofill': {
        WebkitBoxShadow: '0 0 0 1000px transparent inset',
        WebkitTextFillColor: darkTheme.palette.text.primary,
        caretColor: darkTheme.palette.text.primary,
        transition: 'background-color 5000s ease-in-out 0s',
      },
    },
    '& .MuiInputLabel-root': {
      color: darkTheme.palette.text.secondary,
      '&.Mui-focused': { color: '#2A9D8F' },
    },
  };

  const selectFormControlSx = {
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: 'black' },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2A9D8F' },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#2A9D8F',
    },
    '& .MuiSelect-select': { color: darkTheme.palette.text.primary },
    '& .MuiInputLabel-root': {
      color: darkTheme.palette.text.secondary,
      '&.Mui-focused': { color: '#2A9D8F' },
    },
    '& .MuiSvgIcon-root': { color: darkTheme.palette.text.secondary },
  };

  const existingBingo = async (): Promise<BingoConfig | null> => {
    try {
      const response = await fetchWithAuth(`${BASE_URL}/bingo/details`);
      if (!response.ok) return null;
      const json = await response.json();
      return json.data ?? null;
    } catch (e) {
      console.error(`Unable to get existing Bingo: ${e}`);
      return null;
    }
  };

  const planBingo = async (details: Bingo): Promise<boolean> => {
    try {
      const response = await fetchWithAuth(`${BASE_URL}/bingo/details`, {
        method: 'POST',
        body: JSON.stringify(details),
      });
      if (response.ok) return true;
      throw new Error(`Failed to send bingo details: ${response.statusText}`);
    } catch (e) {
      console.error(`Unable to send details: ${e}`);
      return false;
    }
  };

  const modifyBingo = async (details: Partial<Bingo>): Promise<boolean> => {
    try {
      const current = await existingBingo();
      if (!current?.id) {
        console.error('No active bingo found to modify');
        return false;
      }
      const response = await fetchWithAuth(`${BASE_URL}/bingo/${current.id}`, {
        method: 'PUT',
        body: JSON.stringify(details),
      });
      if (response.ok) return true;
      throw new Error(`Failed to modify bingo details: ${response.statusText}`);
    } catch (e) {
      console.error(`Unable to update details: ${e}`);
      return false;
    }
  };

  // Handlers
  const handleSubmit = async () => {
    const details = {
      name: bingoName,
      start: startDate,
      end: endDate,
      size: boardSize,
      numberOfTeams,
      teams: teamNames,
    };
    const success = isBingo ? await modifyBingo(details) : await planBingo(details);
    if (success) setSubmitted(true);
  };

  const handleTeamNameChange = (index: number, value: string) => {
    const updated = [...teamNames];
    updated[index] = value;
    setTeamNames(updated);
  };

  const handleStartDateChange = (newDate: Date | null) => {
    setStartDate(newDate ? newDate.toISOString() : '');
  };

  const handleEndDateChange = (newDate: Date | null) => {
    setEndDate(newDate ? newDate.toISOString() : '');
  };

  const clearBingo = () => {
    setBingoName('');
    setStartDate('');
    setEndDate('');
    setBoardSize(16);
    setNumberOfTeams(3);
    setTeamNames([]);
  };

  // On mount: check for existing bingo and pre-populate form
  useEffect(() => {
    existingBingo().then((data) => {
      if (data) {
        setIsBingo(true);
        setBingoName(data.name);
        setBoardSize(data.boardSize);
        setStartDate(data.startDate);
        setEndDate(data.endDate);
        setNumberOfTeams(data.numberOfTeams ?? 3);
        setTeamNames(data.teams ?? []);
      }
    });
  }, []);

  return {
    // Form values
    bingoName,
    setBingoName,
    startDate,
    endDate,
    boardSize,
    setBoardSize,
    numberOfTeams,
    setNumberOfTeams,
    teamNames,
    // UI state
    isBingo,
    submitted,
    setSubmitted,
    // Derived
    isFormValid,
    hasFormData,
    // Styles
    inputSx,
    selectFormControlSx,
    // Handlers
    handleSubmit,
    handleTeamNameChange,
    handleStartDateChange,
    handleEndDateChange,
    clearBingo,
  };
};
