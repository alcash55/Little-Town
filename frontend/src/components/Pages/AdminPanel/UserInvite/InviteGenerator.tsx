import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { appColors } from '../../../../layout/Theme';
import {
  EXPIRY_PRESETS,
  INVITE_ROLES,
  Invite,
  InviteRole,
} from './useUserInvite';
import InviteCopyButton from './InviteCopyButton';

const DEFAULT_ROLE: InviteRole = 'user';
const DEFAULT_HOURS = 72;

interface Props {
  generating: boolean;
  generateError: string | null;
  justCreated: Invite | null;
  onGenerate: (role: InviteRole, expiresInHours: number) => void;
  onDismissCreated: () => void;
  onDismissGenerateError: () => void;
}

const InviteGenerator = ({
  generating,
  generateError,
  justCreated,
  onGenerate,
  onDismissCreated,
  onDismissGenerateError,
}: Props) => {
  const [role, setRole] = useState<InviteRole>(DEFAULT_ROLE);
  const [hours, setHours] = useState<number>(DEFAULT_HOURS);

  const handleRoleChange = (e: SelectChangeEvent) => setRole(e.target.value as InviteRole);
  const handleHoursChange = (e: SelectChangeEvent<number>) => setHours(Number(e.target.value));

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h3" sx={{ fontSize: 18, color: appColors.textPrimary }}>
          Generate an invite link
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="invite-role-label">Role</InputLabel>
            <Select
              labelId="invite-role-label"
              id="invite-role"
              label="Role"
              value={role}
              onChange={handleRoleChange}
            >
              {INVITE_ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="invite-expiry-label">Expires in</InputLabel>
            <Select
              labelId="invite-expiry-label"
              id="invite-expiry"
              label="Expires in"
              value={hours}
              onChange={handleHoursChange}
            >
              {EXPIRY_PRESETS.map((preset) => (
                <MenuItem key={preset.hours} value={preset.hours}>
                  {preset.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            disabled={generating}
            onClick={() => onGenerate(role, hours)}
            startIcon={
              generating ? (
                <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
              ) : (
                <LinkIcon />
              )
            }
            sx={{
              bgcolor: appColors.accent,
              color: appColors.textPrimary,
              '&:hover': { bgcolor: appColors.accent, opacity: 0.85 },
              alignSelf: { xs: 'flex-start', sm: 'center' },
            }}
          >
            {generating ? 'Generating…' : 'Generate link'}
          </Button>
        </Stack>

        {generateError && (
          <Alert severity="error" onClose={onDismissGenerateError}>
            {generateError}
          </Alert>
        )}

        {justCreated && (
          <Alert
            severity="success"
            onClose={onDismissCreated}
            icon={<LinkIcon fontSize="inherit" />}
            sx={{ alignItems: 'center' }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography
                variant="body2"
                component="code"
                sx={{
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {justCreated.url}
              </Typography>
              <InviteCopyButton url={justCreated.url} label="invite link" />
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.85 }}>
              This is the only time the full link is shown here — copy it now. It's single-use and
              expires {new Date(justCreated.expiresAt).toLocaleString()}.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default InviteGenerator;
