import {
  Box,
  Button,
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
    planBingo,
    clearBingo,
  } = useBingoDetails();

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: 'black',
      '& fieldset': { borderColor: 'black' },
      '&:hover fieldset': { borderColor: '#2A9D8F' },
      '&.Mui-focused fieldset': { borderColor: '#2A9D8F' },
    },
    '& .MuiInputLabel-root': {
      color: 'black',
      '&.Mui-focused': { color: '#2A9D8F' },
    },
  };

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
          sx={inputSx}
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
            sx={inputSx}
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
            sx={inputSx}
          />
        </Box>

        {/* board size */}
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

        {/* # of teams */}
        <FormControl variant="standard" sx={{ m: 1, width: '100%' }} required={true}>
          <InputLabel id="team-size-select-label">Number of teams playing</InputLabel>
          <Select
            labelId="team-size-select-label"
            id="team-size"
            value={numberOfTeams}
            onChange={(e: any) => setNumberOfTeams(e.target.value)}
            label="Team Size"
          >
            <MenuItem value={2}>2</MenuItem>
            <MenuItem value={3}>3</MenuItem>
            <MenuItem value={4}>4</MenuItem>
            <MenuItem value={5}>5</MenuItem>
          </Select>
        </FormControl>

        <Stack spacing={2} width={'100%'}>
          {numberOfTeams != null ? (
            <>
              {Array.from({ length: numberOfTeams }).map((_, index) => {
                return (
                  <TextField
                    key={`team-${index}`}
                    id={`team-${index}`}
                    label={`Team ${index + 1}`}
                    value={teamNames[index] || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const newTeamNames = [...teamNames];
                      newTeamNames[index] = e.target.value;
                      setTeamNames(newTeamNames);
                    }}
                    variant="outlined"
                    fullWidth
                    sx={inputSx}
                  />
                );
              })}
            </>
          ) : null}
        </Stack>
        <Stack spacing={2} direction={'row'} width={'100%'}>
          <Button
            disabled={
              !(
                teamNames.length > 0 &&
                numberOfTeams >= 2 &&
                numberOfTeams <= 5 &&
                endDate !== '' &&
                startDate !== '' &&
                bingoName !== '' &&
                (boardSize === 16 || boardSize === 35)
              )
            }
            variant="outlined"
            onClick={() =>
              planBingo({
                name: bingoName,
                start: startDate,
                end: endDate,
                size: boardSize,
                numberOfTeams: numberOfTeams,
                teams: teamNames,
              })
            }
            color="success"
            sx={{ width: '50%' }}
          >
            Add Bingo Detail
          </Button>

          {teamNames.length || endDate || startDate || bingoName ? (
            <Button variant="outlined" onClick={clearBingo} color="error" sx={{ width: '50%' }}>
              Clear
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  );
};

export default BingoDetails;
