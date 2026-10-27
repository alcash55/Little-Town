import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepButton,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { clan } from '../../../../config/clan';
import { useBingoDetails } from './useBingoDetails';
import { BingoLifecycle } from './BingoLifecycle';
import PageLayout from '../../../../layout/PageLayout/PageLayout';

export function BingoDetails() {
  const details = useBingoDetails();
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [saving, setSaving] = useState(false);
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
  } = details;
  const datesValid = Boolean(
    bingoName.trim() && startDate && endDate && new Date(endDate) > new Date(startDate),
  );
  const teamsValid =
    numberOfTeams >= 2 &&
    numberOfTeams <= 5 &&
    teamNames.slice(0, numberOfTeams).length === numberOfTeams &&
    teamNames.slice(0, numberOfTeams).every((n) => n.trim());
  const advance = (next: number) => {
    if (next > 0 && !datesValid) {
      setStepError('Enter a bingo name and choose an end date after the start.');
      return;
    }
    if (next > 1 && !teamsValid) {
      setStepError('Give every team a name before reviewing.');
      return;
    }
    if (
      next > 1 &&
      new Set(teamNames.slice(0, numberOfTeams).map((name) => name.trim().toLowerCase())).size !==
        numberOfTeams
    ) {
      setStepError('Each team needs a different name.');
      return;
    }
    setStepError('');
    setStep(next);
  };
  const save = async () => {
    if (!datesValid || !teamsValid || !isFormValid) return;
    setSaving(true);
    try {
      await handleSubmit();
    } finally {
      setSaving(false);
    }
  };
  const formatDate = (value: string) =>
    value
      ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : 'Not set';
  return (
    <PageLayout
      title="Set up your bingo"
      maxWidth="full"
      showExistingWarning={isBingo}
      submitted={submitted}
      successMessage="Bingo details saved."
      warningMessage="You are editing an existing event. Saving replaces its current details."
      permissionDenied={permissionDenied}
      error={submitError ?? loadError}
    >
      <Typography color="text.secondary">
        Event details, board format, and team names. Review everything before saving.
      </Typography>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '190px minmax(0, 680px)' },
            gap: 4,
            alignItems: 'start',
          }}
        >
          <Stepper
            nonLinear
            activeStep={step}
            orientation="vertical"
            sx={{
              '& .MuiStepLabel-label': { fontSize: 13 },
              '& .MuiStepConnector-line': { borderColor: 'divider' },
            }}
          >
            {['Event & dates', 'Board & teams', 'Review & save'].map((label, index) => (
              <Step key={label}>
                <StepButton onClick={() => advance(index)}>{label}</StepButton>
              </Step>
            ))}
          </Stepper>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 2) advance(step + 1);
              else void save();
            }}
            sx={{ minWidth: 0, borderTop: 1, borderColor: 'divider', pt: 3 }}
          >
            {stepError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {stepError}
              </Alert>
            )}
            <Typography variant="overline" color="text.secondary">
              Step {step + 1} of 3
            </Typography>
            {step === 0 && (
              <Stack spacing={3} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="h2">Name it. Set the dates.</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Choose when the competition begins and ends. Times use your local time zone.
                  </Typography>
                </Box>
                <TextField
                  id="bingo-name"
                  label="Bingo name"
                  placeholder={`${new Date().getFullYear()} ${clan.name} Bingo`}
                  value={bingoName}
                  onChange={(e) => setBingoName(e.target.value)}
                  fullWidth
                  required
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <DateTimePicker
                    label="Start"
                    showDaysOutsideCurrentMonth
                    minDate={minStartDate}
                    value={startDate ? new Date(startDate) : null}
                    onChange={handleStartDateChange}
                    slotProps={{ textField: { required: true, fullWidth: true } }}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  <DateTimePicker
                    label="End"
                    showDaysOutsideCurrentMonth
                    minDate={minEndDate}
                    value={endDate ? new Date(endDate) : null}
                    onChange={handleEndDateChange}
                    slotProps={{ textField: { required: true, fullWidth: true } }}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                </Stack>
              </Stack>
            )}
            {step === 1 && (
              <Stack spacing={3} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="h2">Set the board. Name the teams.</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Players are assigned in the team drafter after saving these details.
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl fullWidth required>
                    <InputLabel id="board-size-label">Board size</InputLabel>
                    <Select
                      labelId="board-size-label"
                      id="board-size"
                      label="Board size"
                      value={boardSize}
                      onChange={(e) => setBoardSize(Number(e.target.value))}
                    >
                      <MenuItem value={16}>4 × 4</MenuItem>
                      <MenuItem value={35}>35 tiles</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth required>
                    <InputLabel id="team-size-select-label">Number of teams playing</InputLabel>
                    <Select
                      labelId="team-size-select-label"
                      id="team-size"
                      label="Number of teams playing"
                      value={numberOfTeams}
                      onChange={(e) => setNumberOfTeams(Number(e.target.value))}
                    >
                      {[2, 3, 4, 5].map((n) => (
                        <MenuItem key={n} value={n}>
                          {n} teams
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                {Array.from({ length: numberOfTeams }, (_, i) => (
                  <TextField
                    key={i}
                    id={`team-${i}`}
                    label={`Team ${i + 1}`}
                    value={teamNames[i] || ''}
                    onChange={(e) => handleTeamNameChange(i, e.target.value)}
                    fullWidth
                    required
                  />
                ))}
              </Stack>
            )}
            {step === 2 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="h2">Everything in one view.</Typography>
                <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                  Check all the event details before {isBingo ? 'updating' : 'creating'} the bingo.
                </Typography>
                <Box
                  component="dl"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                    my: 3,
                  }}
                >
                  {[
                    ['Bingo name', bingoName],
                    ['Start', formatDate(startDate)],
                    ['End', formatDate(endDate)],
                    ['Board size', boardSize === 16 ? '4 × 4' : '35 tiles'],
                    ['Number of teams', String(numberOfTeams)],
                    ['Team names', teamNames.slice(0, numberOfTeams).join(', ')],
                  ].map(([label, value]) => (
                    <Box key={label} sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                      <Typography component="dt" variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography component="dd" sx={{ m: 0, mt: 1 }}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Button onClick={() => advance(0)} sx={{ px: 0 }}>
                  ← Edit event details
                </Button>
              </Box>
            )}
            <Stack
              direction="row"
              spacing={1}
              sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 4,
                pt: 2,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <Button
                disabled={!hasFormData || saving}
                onClick={() => {
                  clearBingo();
                  setStep(0);
                  setStepError('');
                }}
              >
                Clear
              </Button>
              <Stack direction="row" spacing={1}>
                <Button disabled={step === 0 || saving} onClick={() => advance(step - 1)}>
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || (step === 2 && (!isFormValid || !teamsValid || !datesValid))}
                >
                  {saving
                    ? 'Saving…'
                    : step < 2
                    ? 'Continue →'
                    : isBingo
                    ? 'Modify Bingo'
                    : 'Add Bingo Details'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Box>
        <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider', maxWidth: 900 }}>
          <BingoLifecycle
            source={bingoId ? { id: bingoId, name: bingoName, status: bingoStatus } : null}
            onChanged={refetchBingo}
          />
        </Box>
      </LocalizationProvider>
    </PageLayout>
  );
}
export default BingoDetails;
