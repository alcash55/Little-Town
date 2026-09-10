import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { appColors } from '../../../../layout/Theme';

export type DeleteBingoDialogProps = {
  open: boolean;
  bingoName: string;
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (typedName: string) => void;
};

/**
 * Typed-name confirmation for the "Delete Bingo" control (TEAM-BRIEF.md
 * Sprint 17, Track B1 #2) — the only destructive endpoint in the app. The
 * Delete button stays disabled until the typed text is an EXACT match for
 * the bingo's name (case-sensitive, no trimming) — that exact text is what
 * gets sent as the `X-Confirm-Delete` header, never auto-filled.
 */
export function DeleteBingoDialog({
  open,
  bingoName,
  deleting,
  error,
  onClose,
  onConfirm,
}: DeleteBingoDialogProps) {
  const [typed, setTyped] = useState('');

  // Fresh input every time the dialog (re)opens — a stale match from a
  // previous open must never leave the button pre-enabled.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const matches = typed === bingoName;

  return (
    <Dialog
      open={open}
      onClose={deleting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="delete-bingo-dialog-title"
    >
      <DialogTitle id="delete-bingo-dialog-title">
        <Typography variant="h6" component="span" sx={{ color: 'error.main' }}>
          Delete &quot;{bingoName}&quot;?
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: appColors.textSecondary, mb: 2 }}>
          This permanently deletes the bingo and everything tied to it — teams, tiles, players,
          submissions, and any stored screenshots. <strong>This cannot be undone.</strong>
        </DialogContentText>
        <DialogContentText sx={{ color: appColors.textSecondary, mb: 1.5 }}>
          Type the bingo&apos;s name exactly to confirm:
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={bingoName}
          label="Bingo name"
          slotProps={{ htmlInput: { 'aria-label': 'Type the bingo name to confirm deletion' } }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={deleting} sx={{ color: appColors.textSecondary }}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(typed)}
          disabled={!matches || deleting}
          variant="contained"
          color="error"
        >
          {deleting ? 'Deleting…' : 'Delete Bingo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
