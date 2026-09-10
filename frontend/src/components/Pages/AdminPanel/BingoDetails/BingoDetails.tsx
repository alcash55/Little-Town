import { Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useBingoDetails } from './useBingoDetails';
import { BingoLifecycle } from './BingoLifecycle';
import PageLayout from '../../../../layout/PageLayout/PageLayout';

const BingoDetails = () => {
  const {
    bingoName,
    setBingoName,
    startDate,
    endDate,
    boardSize,
    setBoardSize,
    numberOfTeams,
    setNumberOfTeams,
    teamNames,
    bingoId,
    bingoStatus,
    refetchBingo,
    isBingo,
    submitted,
    setSubmitted,
    submitError,
    permissionDenied,
    loadError,
    isFormValid,
    hasFormData,
    handleSubmit,
    handleTeamNameChange,
    handleStartDateChange,
    handleEndDateChange,
    clearBingo,
    minStartDate,
    minEndDate,
  } = useBingoDetails();

  return (
    <PageLayout
      title="Bingo Details"
      showExistingWarning={isBingo}
      submitted={submitted}
      successMessage={isBingo ? 'Bingo details updated!' : 'Bingo details created!'}
      warningMessage="Bingo details already exist. Submitting will overwrite them."
      permissionDenied={permissionDenied}
      error={submitError ?? loadError}
    >
      {/* Single LocalizationProvider for the whole page — covers both the
          create/edit form's pickers below and CloneBingoDialog's, which is
          rendered by BingoLifecycle further down this same tree. Providers
          deliberately doesn't supply one globally (see layout/Providers),
          so this is BingoDetails' own, per that comment. */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Stack
          spacing={3}
          sx={{
            justifyContent: 'center',
            alignItems: 'center',
            maxWidth: 500,
            width: '100%',
          }}
        >
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
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
            <DateTimePicker
              label="Start"
              views={['day', 'month', 'hours']}
              showDaysOutsideCurrentMonth
              minDate={minStartDate}
              value={startDate ? new Date(startDate) : null}
              onChange={handleStartDateChange}
              slotProps={{ textField: { required: true, error: false, fullWidth: true } }}
              sx={{ flex: 1, minWidth: 0 }}
            />
            <DateTimePicker
              label="End"
              views={['day', 'month', 'hours']}
              showDaysOutsideCurrentMonth
              minDate={minEndDate}
              value={endDate ? new Date(endDate) : null}
              onChange={handleEndDateChange}
              slotProps={{ textField: { required: true, error: false, fullWidth: true } }}
              sx={{ flex: 1, minWidth: 0 }}
            />
          </Stack>

          <FormControl variant="outlined" sx={{ m: 1, width: '100%' }} required>
            <InputLabel id="board-size-label">Board Size</InputLabel>
            <Select
              labelId="board-size-label"
              id="board-size"
              value={boardSize}
              onChange={(e) => setBoardSize(e.target.value as number)}
              label="Board Size"
            >
              <MenuItem value={16}>4X4</MenuItem>
              <MenuItem value={35}>5X5</MenuItem>
            </Select>
          </FormControl>

          <FormControl variant="outlined" sx={{ m: 1, width: '100%' }} required>
            <InputLabel id="team-size-select-label">Number of teams playing</InputLabel>
            <Select
              labelId="team-size-select-label"
              id="team-size"
              value={numberOfTeams}
              onChange={(e) => setNumberOfTeams(e.target.value as number)}
              label="Number of teams playing"
            >
              <MenuItem value={2}>2</MenuItem>
              <MenuItem value={3}>3</MenuItem>
              <MenuItem value={4}>4</MenuItem>
              <MenuItem value={5}>5</MenuItem>
            </Select>
          </FormControl>

          <Stack
            spacing={2}
            sx={{
              width: '100%',
            }}
          >
            {Array.from({ length: numberOfTeams }).map((_, index) => (
              <TextField
                key={`team-${index}`}
                id={`team-${index}`}
                label={`Team ${index + 1}`}
                value={teamNames[index] || ''}
                onChange={(e) => handleTeamNameChange(index, e.target.value)}
                variant="outlined"
                fullWidth
              />
            ))}
          </Stack>

          <Stack
            spacing={2}
            direction="row"
            sx={{
              width: '100%',
            }}
          >
            <Button
              variant="outlined"
              color={isBingo ? 'info' : 'success'}
              disabled={!isFormValid}
              onClick={handleSubmit}
              sx={{ width: '50%' }}
            >
              {isBingo ? 'Modify Bingo' : 'Add Bingo Details'}
            </Button>
            {hasFormData && (
              <Button variant="outlined" color="error" onClick={clearBingo} sx={{ width: '50%' }}>
                Clear
              </Button>
            )}
          </Stack>

          {/* Always mounted (not gated on isBingo/bingoId) so a Delete's
              success alert survives the very refetch it triggers — that
              refetch is what flips isBingo back to false. BingoLifecycle
              decides its own visibility: nothing to act on AND nothing left
              to report renders null. */}
          <BingoLifecycle
            source={bingoId ? { id: bingoId, name: bingoName, status: bingoStatus } : null}
            onChanged={refetchBingo}
          />
        </Stack>
      </LocalizationProvider>
    </PageLayout>
  );
};

export default BingoDetails;
