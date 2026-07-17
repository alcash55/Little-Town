import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
import { describeApiError } from '../../../../utils/apiError';

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  // True when the gating GET (existing bingo lookup) 401/403'd — the page
  // must show a permission-denied state instead of an empty "no bingo yet"
  // form (bug-report investigation, prod incident: this was previously
  // indistinguishable from "no active bingo exists").
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Derived
  // Start of today (midnight) — no past dates allowed
  const minStartDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // End date must be at least as late as the chosen start date
  const minEndDate = useMemo(
    () => (startDate ? new Date(startDate) : minStartDate),
    [startDate, minStartDate],
  );

  const isFormValid =
    teamNames.length > 0 &&
    numberOfTeams >= 2 &&
    numberOfTeams <= 5 &&
    endDate !== '' &&
    startDate !== '' &&
    bingoName !== '' &&
    (boardSize === 16 || boardSize === 35);

  const hasFormData = !!(teamNames.length || endDate || startDate || bingoName);

  const existingBingo = async (): Promise<BingoConfig | null> => {
    try {
      const response = await fetchWithAuth(`${BASE_URL}/bingo/details`);
      if (!response.ok) {
        const info = await describeApiError(response, 'Failed to load bingo details');
        if (info.isPermissionError) {
          // Distinct from "no active bingo yet" — the caller can't see the
          // answer either way, so don't let the form render as if there's
          // definitely nothing there (bug-report investigation, prod incident).
          setPermissionDenied(true);
        } else if (response.status !== 404) {
          setLoadError(info.message);
        }
        return null;
      }
      setPermissionDenied(false);
      setLoadError(null);
      const json = await response.json();
      return json.data ?? null;
    } catch (e) {
      setLoadError('Unable to reach the server. Please try again.');
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
      const info = await describeApiError(response, 'Failed to create bingo details');
      throw new Error(info.message);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to reach the server. Please try again.';
      setSubmitError(message);
      console.error(`Unable to send details: ${message}`);
      return false;
    }
  };

  const modifyBingo = async (details: Partial<BingoConfig>): Promise<boolean> => {
    try {
      const current = await existingBingo();
      if (!current?.id) {
        const message = permissionDenied
          ? "You don't have permission to modify bingo details."
          : 'No active bingo found to modify.';
        setSubmitError(message);
        console.error(message);
        return false;
      }
      const response = await fetchWithAuth(`${BASE_URL}/bingo/${current.id}`, {
        method: 'PUT',
        body: JSON.stringify(details),
      });
      if (response.ok) return true;
      const info = await describeApiError(response, 'Failed to modify bingo details');
      throw new Error(info.message);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to reach the server. Please try again.';
      setSubmitError(message);
      console.error(`Unable to update details: ${message}`);
      return false;
    }
  };

  // Handlers
  const handleSubmit = async () => {
    setSubmitError(null);
    const details = {
      name: bingoName,
      start: startDate,
      end: endDate,
      size: boardSize,
      numberOfTeams,
      teams: teamNames,
    };
    const modifyDetails = {
      name: bingoName,
      startDate,
      endDate,
      boardSize,
      numberOfTeams,
      teams: teamNames,
    };
    const success = isBingo ? await modifyBingo(modifyDetails) : await planBingo(details);
    if (success) setSubmitted(true);
  };

  const handleTeamNameChange = (index: number, value: string) => {
    const updated = [...teamNames];
    updated[index] = value;
    setTeamNames(updated);
  };

  const handleStartDateChange = (newDate: Date | null) => {
    const iso = newDate ? newDate.toISOString() : '';
    setStartDate(iso);
    // Clear end date if it is now before the new start
    if (iso && endDate && new Date(endDate) < new Date(iso)) {
      setEndDate('');
    }
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
    submitError,
    permissionDenied,
    loadError,
    // Derived
    isFormValid,
    hasFormData,
    // Handlers
    handleSubmit,
    handleTeamNameChange,
    handleStartDateChange,
    handleEndDateChange,
    clearBingo,
    minStartDate,
    minEndDate,
  };
};
