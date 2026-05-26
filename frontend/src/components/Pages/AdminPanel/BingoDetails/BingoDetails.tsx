import {
  Alert,
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
import { DateTimePicker } from '@mui/x-date-pickers';
import { darkTheme } from '../../../../layout/Theme';
import { useBingoDetails } from './useBingoDetails';
import { BingoUpdated } from '../../../BingoUpdated/BingoUpdated'


const BingoDetails = () => {
  const {
    bingoName, setBingoName,
    startDate, endDate,
    boardSize, setBoardSize,
    numberOfTeams, setNumberOfTeams,
    teamNames,
    isBingo, submitted, setSubmitted,
    isFormValid, hasFormData,
    inputSx, selectFormControlSx,
    handleSubmit, handleTeamNameChange,
    handleStartDateChange, handleEndDateChange,
    clearBingo,
  } = useBingoDetails();

  return (
    <Stack spacing={3} width="100%" justifyContent="flex-start" alignItems="center" sx={{
      bgcolor: darkTheme.palette.primary.main, p: 5, minHeight: '100vh',
      boxSizing: 'border-box',
      overflow: 'scroll',
    }}>
      <Typography variant="h1" sx={{ fontSize: 42, textAlign: 'center' }}>
        Bingo Details
      </Typography>

      {submitted ? (
        <BingoUpdated isBingo={isBingo} itemUpdated={'Details'} />
      ) : (
        <>
          {isBingo && (
            <Alert severity="warning" sx={{ width: '100%', maxWidth: 500 }}>
              Bingo details already exist, any changes made will modify the already existing bingo
            </Alert>
          )}

          <Stack spacing={3} justifyContent="center" alignItems="center" sx={{ maxWidth: 500, width: '100%', pt: 0, mt: 0 }}>
            <TextField
              id="bingo-name"
              label="Bingo Name"
              placeholder={`${new Date().getFullYear()} Little Town Bingo`}
              variant="outlined"
              value={bingoName}
              onChange={(e) => setBingoName(e.target.value)}
              fullWidth
              required
              autoFocus
              sx={inputSx}
            />

            <Box sx={{ display: 'flex', justifyContent: 'start', alignItems: 'center', gap: 3 }}>
              <DateTimePicker
                label="Start"
                views={['day', 'month', 'hours']}
                showDaysOutsideCurrentMonth
                disablePast
                value={startDate ? new Date(startDate) : null}
                onChange={handleStartDateChange}
                slotProps={{ textField: { required: true, error: false } }}
                sx={inputSx}
              />
              <DateTimePicker
                label="End"
                views={['day', 'month', 'hours']}
                showDaysOutsideCurrentMonth
                value={endDate ? new Date(endDate) : null}
                onChange={handleEndDateChange}
                slotProps={{ textField: { required: true, error: false } }}
                sx={inputSx}
              />
            </Box>

            <FormControl variant="outlined" sx={{ m: 1, width: '100%', ...selectFormControlSx }} required>
              <InputLabel id="board-size-label">Board Size</InputLabel>
              <Select labelId="board-size-label" id="board-size" value={boardSize} onChange={(e) => setBoardSize(e.target.value as number)} label="Board Size">
                <MenuItem value={16}>4X4</MenuItem>
                <MenuItem value={35}>5X5</MenuItem>
              </Select>
            </FormControl>

            <FormControl variant="outlined" sx={{ m: 1, width: '100%', ...selectFormControlSx }} required>
              <InputLabel id="team-size-select-label">Number of teams playing</InputLabel>
              <Select labelId="team-size-select-label" id="team-size" value={numberOfTeams} onChange={(e) => setNumberOfTeams(e.target.value as number)} label="Number of teams playing">
                <MenuItem value={2}>2</MenuItem>
                <MenuItem value={3}>3</MenuItem>
                <MenuItem value={4}>4</MenuItem>
                <MenuItem value={5}>5</MenuItem>
              </Select>
            </FormControl>

            <Stack spacing={2} width="100%">
              {Array.from({ length: numberOfTeams }).map((_, index) => (
                <TextField
                  key={`team-${index}`}
                  id={`team-${index}`}
                  label={`Team ${index + 1}`}
                  value={teamNames[index] || ''}
                  onChange={(e) => handleTeamNameChange(index, e.target.value)}
                  variant="outlined"
                  fullWidth
                  sx={inputSx}
                />
              ))}
            </Stack>

            <Stack spacing={2} direction="row" width="100%">
              <Button variant="outlined" color={isBingo ? "info" : "success"} disabled={!isFormValid} onClick={handleSubmit} sx={{ width: '50%' }}>
                {isBingo ? 'Modify Bingo' : 'Add Bingo Detail'}
              </Button>
              {hasFormData && (
                <Button variant="outlined" color="error" onClick={clearBingo} sx={{ width: '50%' }}>
                  Clear
                </Button>
              )}
            </Stack>
          </Stack>
        </>
      )}
    </Stack>
  );
};

export default BingoDetails;
