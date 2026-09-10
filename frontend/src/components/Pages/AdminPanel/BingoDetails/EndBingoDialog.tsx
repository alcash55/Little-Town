import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { appColors } from '../../../../layout/Theme';

export type EndBingoDialogProps = {
  open: boolean;
  bingoName: string;
  ending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Confirm-then-end dialog for the "End Bingo Early" control
 * (TEAM-BRIEF.md Sprint 17, Track B1 #1). A 409 ("already not active") is
 * handled by the caller as an information alert on the page, not here — this
 * dialog only needs to show a genuine failure inline so the admin can retry
 * without re-opening it.
 */
export function EndBingoDialog({
  open,
  bingoName,
  ending,
  error,
  onClose,
  onConfirm,
}: EndBingoDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={ending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="end-bingo-dialog-title"
    >
      <DialogTitle id="end-bingo-dialog-title">
        <Typography variant="h6" component="span" sx={{ color: appColors.textPrimary }}>
          End &quot;{bingoName}&quot; early?
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: appColors.textSecondary }}>
          Teams stop earning points immediately and the bingo moves to Complete. This does not
          delete any data — submissions already in review stay reviewable afterward.
        </DialogContentText>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={ending} sx={{ color: appColors.textSecondary }}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={ending} variant="contained" color="warning">
          {ending ? 'Ending…' : 'End Bingo Early'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
