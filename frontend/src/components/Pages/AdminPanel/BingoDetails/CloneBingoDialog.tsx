import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { appColors } from '../../../../layout/Theme';

export type CloneBingoDialogProps = {
  open: boolean;
  sourceBingoName: string;
  cloning: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (input: { name: string; startDate: string; endDate: string }) => void;
};

/**
 * Name + start/end date form for the "Clone Board Into New Draft" control
 * (TEAM-BRIEF.md Sprint 17, Track B1 #3). Copies board tiles only — the
 * dialog text says as much so the admin doesn't expect teams/players/
 * submissions to come along.
 */
export function CloneBingoDialog({
  open,
  sourceBingoName,
  cloning,
  error,
  onClose,
  onConfirm,
}: CloneBingoDialogProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fresh form every time the dialog (re)opens, seeded with a sensible
  // default name — same pattern as DeleteBingoDialog's reset-on-open.
  useEffect(() => {
    if (open) {
      setName(`${sourceBingoName} (Copy)`);
      setStartDate('');
      setEndDate('');
    }
  }, [open, sourceBingoName]);

  const minStartDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const minEndDate = useMemo(
    () => (startDate ? new Date(startDate) : minStartDate),
    [startDate, minStartDate],
  );

  const isValid = name.trim() !== '' && startDate !== '' && endDate !== '';

  const handleStartDateChange = (newDate: Date | null) => {
    const iso = newDate ? newDate.toISOString() : '';
    setStartDate(iso);
    if (iso && endDate && new Date(endDate) < new Date(iso)) {
      setEndDate('');
    }
  };

  const handleEndDateChange = (newDate: Date | null) => {
    setEndDate(newDate ? newDate.toISOString() : '');
  };

  return (
    <Dialog
      open={open}
      onClose={cloning ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="clone-bingo-dialog-title"
    >
      <DialogTitle id="clone-bingo-dialog-title">
        <Typography variant="h6" component="span" sx={{ color: appColors.textPrimary }}>
          Clone board into a new draft
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: appColors.textSecondary, mb: 2 }}>
          Copies &quot;{sourceBingoName}&quot;&apos;s board tiles into a new draft bingo. Teams,
          players, submissions, and snapshots are never copied.
        </DialogContentText>
        <Stack spacing={2}>
          <TextField
            autoFocus
            fullWidth
            label="New bingo name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <DateTimePicker
            label="Start"
            views={['day', 'month', 'hours']}
            showDaysOutsideCurrentMonth
            minDate={minStartDate}
            value={startDate ? new Date(startDate) : null}
            onChange={handleStartDateChange}
            slotProps={{ textField: { required: true, error: false, fullWidth: true } }}
          />
          <DateTimePicker
            label="End"
            views={['day', 'month', 'hours']}
            showDaysOutsideCurrentMonth
            minDate={minEndDate}
            value={endDate ? new Date(endDate) : null}
            onChange={handleEndDateChange}
            slotProps={{ textField: { required: true, error: false, fullWidth: true } }}
          />
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={cloning} sx={{ color: appColors.textSecondary }}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm({ name: name.trim(), startDate, endDate })}
          disabled={!isValid || cloning}
          variant="contained"
          sx={{
            bgcolor: appColors.accent,
            '&:hover': { bgcolor: appColors.accent, opacity: 0.85 },
          }}
        >
          {cloning ? 'Cloning…' : 'Clone'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
