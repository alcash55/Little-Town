import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import GamesIcon from '@mui/icons-material/Games';
import PeopleIcon from '@mui/icons-material/People';
import { Box, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Dispatch } from 'react';

interface BingoStepsProps {
  bingoName: string;
  setBingoName: Dispatch<React.SetStateAction<string>>;
  startDate: string;
  setStartDate: Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: Dispatch<React.SetStateAction<string>>;
  boardSize: number;
  setBoardSize: Dispatch<React.SetStateAction<number>>;
  numberOfTeams: number;
  setNumberOfTeams: Dispatch<React.SetStateAction<number>>;
  teamNames: string[];
  setTeamNames: Dispatch<React.SetStateAction<string[]>>;
}

export const BingoSteps = ({
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
}: BingoStepsProps) => {
  const steps = [
    {
      title: 'Basic Information',
      connector: <DriveFileRenameOutlineIcon />,
      questions: [
        {
          title: 'Bingo Name',
          description: 'Enter the name of the bingo, this will be displayed above the bingo board.',
          stepComponent: (
            <TextField
              id="bingo-name"
              label="Bingo Name"
              helperText="Bingo Name"
              placeholder={`${new Date().getFullYear()} Little Town Bingo`}
              defaultValue={`${new Date().getFullYear()} Little Town Bingo`}
              variant="outlined"
              value={bingoName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const newName = e.target.value;
                console.log(newName);
                setBingoName(newName);
              }}
              fullWidth
              required
              color="secondary"
            />
          ),
        },
        {
          title: 'Bingo Start & End Dates',
          description: 'Select when the bingo will start and end.',
          stepComponent: (
            <Box sx={{ display: 'flex', justifyContent: 'start', alignItems: 'center', gap: 3 }}>
              <DateTimePicker
                label="Start"
                views={['day', 'month', 'hours']}
                showDaysOutsideCurrentMonth
                disablePast
                value={new Date(startDate)}
                onChange={(newDate) => {
                  setStartDate(String(newDate));
                  console.log(startDate);
                }}
                slotProps={{
                  textField: {
                    required: true,
                  },
                }}
              />
              <DateTimePicker
                label="End"
                views={['day', 'month', 'hours']}
                showDaysOutsideCurrentMonth
                value={new Date(endDate)}
                onChange={(newDate) => {
                  setEndDate(String(newDate));
                  console.log(endDate);
                }}
                slotProps={{
                  textField: {
                    required: true,
                  },
                }}
              />
            </Box>
          ),
        },
      ],
    },
    {
      title: 'Bingo Information',
      connector: <GamesIcon />,
      questions: [
        {
          title: 'Board Size',
          description: 'Select the size of the bingo board.',
          stepComponent: (
            <FormControl
              variant="standard"
              sx={{ m: 1, minWidth: 120, width: 'auto' }}
              required={true}
            >
              <InputLabel id="board-size-label-label">Age</InputLabel>
              <Select
                labelId="board-size-label"
                id="board-size"
                value={boardSize}
                onChange={(e: any) => setBoardSize(e.target.value)}
                label="Board Size"
              >
                <MenuItem value={16}>4X4</MenuItem>
                <MenuItem value={35}>5X5</MenuItem>
              </Select>
            </FormControl>
          ),
        },
        {
          title: 'Number of teams',
          description: 'Select the total number of teams that will play in this bingo.',
          stepComponent: (
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }} required={true}>
              <InputLabel id="team-size-select-label">Size</InputLabel>
              <Select
                labelId="team-size-label"
                id="team-size"
                value={numberOfTeams}
                onChange={(e: any) => setNumberOfTeams(e.target.value)}
                label="Team Size"
                color="secondary"
              >
                <MenuItem value={3}>3</MenuItem>
                <MenuItem value={4}>4</MenuItem>
                <MenuItem value={5}>5</MenuItem>
              </Select>
            </FormControl>
          ),
        },
      ],
    },
    {
      title: 'Team Information',
      connector: <PeopleIcon />,
      questions: [
        {
          title: 'Team Names',
          description: "Enter each team's name.",
          stepComponent: (
            <Stack spacing={1} direction={'row'} justifyContent={'space-evenly'} width={'100%'}>
              {Array.from({ length: numberOfTeams }, (_, index) => (
                <TextField
                  key={index}
                  label={`Team ${index + 1}`}
                  value={teamNames[index]}
                  required={true}
                  onChange={(e) => {
                    const newTeamNames = [...teamNames];
                    newTeamNames[index] = e.target.value;
                    setTeamNames(newTeamNames);
                  }}
                  variant="outlined"
                  color="secondary"
                  sx={{ width: '50%' }}
                />
              ))}
            </Stack>
          ),
        },
      ],
    },
  ];

  return steps;
};
