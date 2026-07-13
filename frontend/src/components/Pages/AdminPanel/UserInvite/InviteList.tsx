import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import { appColors } from '../../../../layout/Theme';
import { getInviteStatus, Invite } from './useUserInvite';
import InviteCopyButton from './InviteCopyButton';
import InviteStatusChip from './InviteStatusChip';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

interface Props {
  invites: Invite[];
  loading: boolean;
  error: string | null;
  revokingId: string | null;
  revokeError: string | null;
  onRevoke: (id: string) => void;
  onRefresh: () => void;
}

const InviteList = ({
  invites,
  loading,
  error,
  revokingId,
  revokeError,
  onRevoke,
  onRefresh,
}: Props) => {
  return (
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h3" sx={{ fontSize: 18, color: appColors.textPrimary }}>
          Invites
        </Typography>
        <Tooltip title="Refresh">
          <span>
            <Button
              size="small"
              onClick={onRefresh}
              disabled={loading}
              startIcon={
                loading ? (
                  <CircularProgress size={14} sx={{ color: appColors.accent }} />
                ) : (
                  <RefreshIcon fontSize="small" />
                )
              }
              sx={{ color: appColors.accent }}
            >
              Refresh
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {revokeError && <Alert severity="error">{revokeError}</Alert>}

      {loading && invites.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: appColors.accent }} />
        </Box>
      )}

      {!loading && !error && invites.length === 0 && (
        <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 4 }}>
          <LinkOffIcon sx={{ fontSize: 40, color: appColors.mutedText }} />
          <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
            No invites yet — generate one above to onboard a new member.
          </Typography>
        </Stack>
      )}

      {invites.length > 0 && (
        <TableContainer
          sx={{
            border: `1px solid ${appColors.subtleBorder}`,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.02)',
          }}
        >
          <Table size="small" aria-label="Invite links">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: appColors.textSecondary, fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ color: appColors.textSecondary, fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ color: appColors.textSecondary, fontWeight: 700 }}>Created</TableCell>
                <TableCell sx={{ color: appColors.textSecondary, fontWeight: 700 }}>Expires</TableCell>
                <TableCell sx={{ color: appColors.textSecondary, fontWeight: 700 }}>Used by</TableCell>
                <TableCell align="right" sx={{ color: appColors.textSecondary, fontWeight: 700 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invites.map((invite) => {
                const status = getInviteStatus(invite);
                const isRevoking = revokingId === invite.id;
                return (
                  <TableRow key={invite.id} hover>
                    <TableCell>
                      <InviteStatusChip status={status} />
                    </TableCell>
                    <TableCell sx={{ color: appColors.textPrimary, textTransform: 'capitalize' }}>
                      {invite.role}
                    </TableCell>
                    <TableCell sx={{ color: appColors.textSecondary }}>{fmt(invite.createdAt)}</TableCell>
                    <TableCell sx={{ color: appColors.textSecondary }}>{fmt(invite.expiresAt)}</TableCell>
                    <TableCell sx={{ color: appColors.textSecondary }}>{invite.usedBy ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <InviteCopyButton url={invite.url} label="invite link" />
                        <Tooltip title={status === 'active' ? 'Revoke' : 'Only active invites can be revoked'}>
                          <span>
                            <Button
                              size="small"
                              disabled={status !== 'active' || isRevoking}
                              onClick={() => onRevoke(invite.id)}
                              aria-label={`Revoke invite ${invite.id}`}
                              sx={{
                                minWidth: 0,
                                px: 1,
                                color: '#ff5252',
                                '&.Mui-disabled': { color: 'rgba(255,255,255,0.28)' },
                              }}
                            >
                              {isRevoking ? (
                                <CircularProgress size={16} sx={{ color: 'inherit' }} />
                              ) : (
                                'Revoke'
                              )}
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};

export default InviteList;
