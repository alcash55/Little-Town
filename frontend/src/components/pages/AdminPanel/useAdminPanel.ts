import React, { useState } from 'react';
import { format, parse, addDays } from 'date-fns';

export const useAdminPanel = () => {
  const dateFormat = 'MM/dd/yyyy/HH';
  const today = format(new Date(), dateFormat);
  const tomorrow = format(addDays(new Date(), 1), dateFormat);

  const [bingoName, setBingoName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(tomorrow);
  const [boardSize, setBoardSize] = useState<number>(16);
  const [numberOfTeams, setNumberOfTeams] = useState<number>(3);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<number>(0);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleChange = (
    value: string | any,
    setState: React.Dispatch<React.SetStateAction<any>>,
  ) => {
    setState(value);
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch('http://localhost:8080/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bingoName,
          start: startDate,
          end: endDate,
          size: boardSize,
          numOfTeams: numberOfTeams,
          teamNames: teamNames,
        }),
      });
      console.log('clicked');
      console.log(response);
    } catch (e) {
      console.log(e);
    }
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
    handleChange,
    handleNext,
    handleBack,
    activeStep,
    handleSubmit,
  };
};
