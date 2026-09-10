import {
  Alert,
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { darkTheme } from '../../../../layout/Theme/theme';
import { AdminUserOption, RsnClaimAdminRow } from './useTeamDrafter';
import { outlinedButtonSx, subtleBorder, textPrimary, textSecondary } from './teamDrafterStyles';

// -------------------------------------------------------
// Release / reassign a claimed RSN (TEAM-BRIEF.md Sprint 17, Track B2 item
// 1). Two dialogs, one file — both are small and only ever rendered from
// RsnClaimsTab, mirroring SideAccountsDialog's single-purpose-dialog
// pattern elsewhere in this folder.
// -------------------------------------------------------

const dialogPaperSx = { backgroundColor: darkTheme.palette.primary.main, color: textPrimary };

export type ReleaseRsnClaimDialogProps = {
  claim: RsnClaimAdminRow;
  releasing: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Release requires an explicit confirmation step — a fat-fingered claim
 * today locks that RSN until Alex edits the database by hand, so the
 * "undo" side (release) must not be a single accidental click either.
 */
export function ReleaseRsnClaimDialog({
  claim,
  releasing,
  error,
  onConfirm,
  onClose,
}: ReleaseRsnClaimDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
    >
      <DialogTitle sx={{ fontFamily: "'pacifico', cursive", color: textPrimary }}>
        Release RSN Claim
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="body1" sx={{ color: textPrimary, mb: 1 }}>
          Release <strong>{claim.rsn}</strong> from <strong>{claim.username}</strong>?
        </Typography>
        <Typography variant="body2" sx={{ color: textSecondary }}>
          This unlinks the account immediately. {claim.username} will need to re-claim {claim.rsn}{' '}
          from onboarding before they see their team data again, and anyone can claim it in the
          meantime.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={releasing}
          sx={{ color: textSecondary, borderColor: subtleBorder, ...outlinedButtonSx }}
        >
          Cancel
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={releasing}
          startIcon={releasing ? <CircularProgress size={16} /> : undefined}
          onClick={onConfirm}
          sx={outlinedButtonSx}
        >
          {releasing ? 'Releasing…' : 'Release Claim'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export type ReassignRsnClaimDialogProps = {
  claim: RsnClaimAdminRow;
  users: AdminUserOption[] | null;
  loadingUsers: boolean;
  usersError: string | null;
  selectedUser: AdminUserOption | null;
  onSelectUser: (user: AdminUserOption | null) => void;
  reassigning: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Reassign picks a target user from GET /api/admin/users (the same
 * frozen `{ users: [{ id, label, role }] }` contract the impersonation
 * picker uses). The 409 "target already holds a different claim" case is
 * surfaced verbatim — db/rsnClaims.ts's error message already names the
 * conflicting RSN, so this dialog doesn't need to re-derive it.
 */
export function ReassignRsnClaimDialog({
  claim,
  users,
  loadingUsers,
  usersError,
  selectedUser,
  onSelectUser,
  reassigning,
  error,
  onConfirm,
  onClose,
}: ReassignRsnClaimDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
    >
      <DialogTitle sx={{ fontFamily: "'pacifico', cursive", color: textPrimary }}>
        Reassign RSN Claim
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="body1" sx={{ color: textPrimary, mb: 2 }}>
          Move <strong>{claim.rsn}</strong>&rsquo;s claim from <strong>{claim.username}</strong> to:
        </Typography>
        <Autocomplete<AdminUserOption>
          options={users ?? []}
          loading={loadingUsers}
          loadingText="Loading users…"
          noOptionsText={usersError ? 'Unable to load users.' : 'No users found.'}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={selectedUser}
          onChange={(_event, value) => onSelectUser(value)}
          renderInput={(params) => (
            <TextField {...params} placeholder="Search users…" size="small" autoFocus />
          )}
        />
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={reassigning}
          sx={{ color: textSecondary, borderColor: subtleBorder, ...outlinedButtonSx }}
        >
          Cancel
        </Button>
        <Button
          variant="outlined"
          color="success"
          disabled={reassigning || !selectedUser}
          startIcon={reassigning ? <CircularProgress size={16} /> : undefined}
          onClick={onConfirm}
          sx={outlinedButtonSx}
        >
          {reassigning ? 'Reassigning…' : 'Reassign Claim'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
