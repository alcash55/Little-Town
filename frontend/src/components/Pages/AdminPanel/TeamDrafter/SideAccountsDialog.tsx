import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { darkTheme } from '../../../../layout/Theme/theme';
import { BingoPlayer, SideAccount } from './useTeamDrafter';
import {
  inputSx,
  outlinedButtonSx,
  subtleBorder,
  tableCellSx,
  textPrimary,
  textSecondary,
} from './teamDrafterStyles';

export type SideAccountsDialogProps = {
  player: BingoPlayer;
  sideAccounts: SideAccount[];
  loadingSideAccounts: boolean;
  newSideRsn: string;
  setNewSideRsn: (v: string) => void;
  newSideNotes: string;
  setNewSideNotes: (v: string) => void;
  addingSideAccount: boolean;
  sideAccountError: string | null;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

export function SideAccountsDialog({
  player,
  sideAccounts,
  loadingSideAccounts,
  newSideRsn,
  setNewSideRsn,
  newSideNotes,
  setNewSideNotes,
  addingSideAccount,
  sideAccountError,
  onAdd,
  onRemove,
  onClose,
}: SideAccountsDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { backgroundColor: darkTheme.palette.primary.main, color: textPrimary } }}
    >
      <DialogTitle sx={{ fontFamily: "'pacifico', cursive", color: textPrimary }}>
        Side Accounts - {player.rsn}
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        {sideAccountError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {sideAccountError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'flex-start' }}>
          <TextField
            label="RSN"
            size="small"
            value={newSideRsn}
            onChange={(e) => setNewSideRsn(e.target.value)}
            sx={{ flex: 1, ...inputSx }}
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          />
          <TextField
            label="Notes (optional)"
            size="small"
            value={newSideNotes}
            onChange={(e) => setNewSideNotes(e.target.value)}
            sx={{ flex: 1.5, ...inputSx }}
          />
          <Button
            variant="outlined"
            color="success"
            disabled={addingSideAccount || !newSideRsn.trim()}
            onClick={onAdd}
            sx={{ mt: 0.25, whiteSpace: 'nowrap', ...outlinedButtonSx }}
          >
            {addingSideAccount ? <CircularProgress size={18} /> : 'Add'}
          </Button>
        </Box>

        {loadingSideAccounts ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} sx={{ color: '#2A9D8F' }} />
          </Box>
        ) : sideAccounts.length === 0 ? (
          <Typography variant="body1" sx={{ color: textSecondary }}>
            No side accounts tracked yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                {['RSN', 'Notes', 'Added', ''].map((h) => (
                  <TableCell key={h} sx={{ ...tableCellSx, fontWeight: 600 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sideAccounts.map((sa) => (
                <TableRow
                  key={sa.id}
                  hover
                  sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' } }}
                >
                  <TableCell sx={tableCellSx}>{sa.rsn}</TableCell>
                  <TableCell sx={tableCellSx}>{sa.notes ?? '-'}</TableCell>
                  <TableCell sx={tableCellSx}>
                    {new Date(sa.added_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell sx={{ ...tableCellSx, textAlign: 'center' }}>
                    <IconButton size="small" color="error" onClick={() => onRemove(sa.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{ color: textSecondary, borderColor: subtleBorder, ...outlinedButtonSx }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
