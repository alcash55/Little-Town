import { useState } from 'react';
// import { format, addDays } from 'date-fns';

export const useAdminPanel = () => {
  const dateFormat = 'MM/dd/yyyy/HH';
  // const today = format(new Date(), dateFormat);
  // const tomorrow = format(addDays(new Date(), 1), dateFormat);

  const [bingoName, setBingoName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [boardSize, setBoardSize] = useState<number>(16);
  const [numberOfTeams, setNumberOfTeams] = useState<number>(3);
  const [teamNames, setTeamNames] = useState<string[]>(Array(numberOfTeams).fill(''));
  const [activeStep, setActiveStep] = useState<number>(0);
  const [tab, setTab] = useState<number>(1);

  const setActiveTab = (event: React.SyntheticEvent, newTab: number) => {
    setTab(newTab);
  };

  const handleFormNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleFormBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    const data = {
      name: bingoName,
      start: startDate,
      end: endDate,
      size: boardSize,
      numOfTeams: numberOfTeams,
      teamNames: teamNames,
    };
    console.log(data);
    try {
      if (validateForm()) {
        const response = await fetch('http://localhost:8080/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        console.log('clicked');
        console.log(response.body);
      } else {
        throw new Error('Unable to create bingo, please check form');
      }
    } catch (e) {
      console.log(e);
    }
  };

  const validateDates = () => {};

  const validateForm = () => {
    const teams = teamNames.find((name) => {
      name === '' ? name : '';
    });

    if (teams && bingoName) {
      return true;
    } else {
      return false;
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
    handleFormNext,
    handleFormBack,
    activeStep,
    handleSubmit,
    validateForm,
    tab,
    setActiveTab,
  };
};
