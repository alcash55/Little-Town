import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import GamesIcon from '@mui/icons-material/Games';
import { Box, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useAdminPanel } from './useAdminPanel';

export const BingoSteps = () => {
  const {
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
  } = useAdminPanel();

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
              placeholder={`${new Date().getFullYear()} Little Town Bingo`}
              variant="outlined"
              onChange={(e) => {
                handleChange(e.target.name, setBingoName);
              }}
              fullWidth
              required
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
                  handleChange(newDate, setStartDate);
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
                  handleChange(newDate, setEndDate);
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
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
              <InputLabel id="demo-simple-select-standard-label">Age</InputLabel>
              <Select
                labelId="board-size-label"
                id="board-size"
                value={boardSize}
                onChange={(e: any) => handleChange(e.target.value, setBoardSize)}
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
            <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
              <InputLabel id="board-size-select-label">Size</InputLabel>
              <Select
                labelId="board-size-label"
                id="board-size"
                value={numberOfTeams}
                onChange={(e: any) => handleChange(e.target.value, setNumberOfTeams)}
                label="Board Size"
              >
                <MenuItem value={3}>3</MenuItem>
                <MenuItem value={4}>4</MenuItem>
                <MenuItem value={5}>5</MenuItem>
              </Select>
            </FormControl>
          ),
        },
        {
          title: 'What are the team names?',
          description: 'Enter the names of the teams.',
          stepComponent: <TextField label="Team Names" variant="outlined" fullWidth />,
        },
        {
          title: 'Make the teams',
          description: 'Enter the names of the teams.',
          stepComponent: <TextField label="Team Names" variant="outlined" fullWidth />,
        },
      ],
    },
  ];

  return steps;
};
