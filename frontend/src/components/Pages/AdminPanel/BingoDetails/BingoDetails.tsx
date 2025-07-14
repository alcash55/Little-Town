import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { darkTheme } from '../../../../layout/Theme';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useBingoDetails } from './useBingoDetails';

const BingoDetails = () => {
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
  } = useBingoDetails();

  return (
    <Stack
      spacing={3}
      height={'100%'}
      width={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
      sx={{ bgcolor: darkTheme.palette.primary.main, p: 5 }}
    >
      <Typography variant="h1" sx={{ fontSize: 42, textAlign: 'center' }}>
        Bingo Details
      </Typography>

      <Stack
        spacing={3}
        justifyContent={'center'}
        alignItems={'center'}
        sx={{ maxWidth: 500, width: '100%', height: '100%' }}
      >
        <TextField
          id="bingo-name"
          label="Bingo Name"
          placeholder={`${new Date().getFullYear()} Little Town Bingo`}
          variant="outlined"
          value={bingoName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setBingoName(e.target.value);
          }}
          fullWidth
          required={true}
          autoFocus
        />

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

        <FormControl variant="standard" sx={{ m: 1, width: '100%' }} required={true}>
          <InputLabel id="board-size-label-label">Board Size</InputLabel>
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

        <FormControl variant="standard" sx={{ m: 1, width: '100%' }} required={true}>
          <InputLabel id="team-size-select-label">Number of teams playing</InputLabel>
          <Select
            labelId="team-size-label"
            id="team-size"
            value={numberOfTeams}
            onChange={(e: any) => setNumberOfTeams(e.target.value)}
            label="Team Size"
          >
            <MenuItem value={3}>3</MenuItem>
            <MenuItem value={4}>4</MenuItem>
            <MenuItem value={5}>5</MenuItem>
          </Select>
        </FormControl>

        <Stack spacing={2} width={'100%'}>
          {teamNames.map((name, index) => (
            <TextField
              key={`team-${index}`}
              id={`team-${index}`}
              label={`Team ${index + 1}`}
              value={name}
              // onChange={(e: React.ChangeEvent<HTMLInputElement>) => }
              variant="outlined"
              fullWidth
            />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
};

export default BingoDetails;
