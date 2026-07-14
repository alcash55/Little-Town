import { FormEvent, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../layout/Theme';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import { useInviteAccept } from './useInviteAccept';
import InviteInvalidState from './InviteInvalidState';

const ROLE_LABEL: Record<string, string> = {
  user: 'player',
  moderator: 'moderator',
  admin: 'admin',
};

/**
 * /invite/:token — the missing half of the admin invite-link flow (invites
 * are generated at AdminPanel/UserInvite, see useUserInvite.ts's doc
 * comment for the shared contract). Public route: must be reachable signed
 * out, see Routes.tsx.
 *
 * Backend contract (backend/src/routes/invites.ts):
 *   GET  /api/invites/:token          -> { valid, reason?, role? }
 *   POST /api/invites/:token/accept   { username, password, nickname? }
 *                                      -> 201 { success, data: { user, token, expiresAt } }
 */
const InviteAccept = () => {
  const { openLogin } = useLoginModal();
  const { checkState, reason, role, submitting, formError, submit, retryCheck } = useInviteAccept();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(username, password, nickname);
  };

  if (checkState === 'checking') {
    return (
      <PageLayout align="center">
        <CircularProgress sx={{ color: appColors.accent }} />
        <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
          Checking your invite…
        </Typography>
      </PageLayout>
    );
  }

  if (checkState === 'checkFailed') {
    return (
      <PageLayout title="Something went wrong" align="center">
        <Typography variant="body1" sx={{ textAlign: 'center', color: appColors.textSecondary }}>
          We couldn't check this invite link. Check your connection and try again.
        </Typography>
        <Button variant="outlined" color="success" onClick={retryCheck}>
          Try again
        </Button>
      </PageLayout>
    );
  }

  if (checkState === 'invalid' && reason) {
    return (
      <PageLayout align="center">
        <InviteInvalidState reason={reason} onOpenLogin={openLogin} />
      </PageLayout>
    );
  }

  // checkState === 'valid'. On successful submit, useInviteAccept signs the
  // user in and navigates to '/' itself (see its doc comment) — there's no
  // separate "success" state to render here.
  return (
    <PageLayout title="You're invited!" maxWidth={420}>
      {role && (
        <Typography variant="body2" sx={{ color: appColors.textSecondary, textAlign: 'center' }}>
          Create your account to join Little Town as a {ROLE_LABEL[role] ?? role}.
        </Typography>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}
      >
        <TextField
          id="invite-username"
          label="Username"
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          required
          autoFocus
          autoComplete="username"
          slotProps={{ htmlInput: { minLength: 3, maxLength: 32 } }}
          helperText="3-32 characters: letters, numbers, underscores, periods, hyphens"
        />
        <TextField
          id="invite-nickname"
          label="Nickname (optional)"
          variant="outlined"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          fullWidth
          autoComplete="nickname"
          slotProps={{ htmlInput: { maxLength: 50 } }}
        />
        <TextField
          id="invite-password"
          label="Password"
          variant="outlined"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          required
          autoComplete="new-password"
          helperText="At least 8 characters"
          slotProps={{
            htmlInput: { minLength: 8 },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? (
                      <VisibilityOffIcon fontSize="small" />
                    ) : (
                      <VisibilityIcon fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        {formError && (
          <Typography variant="body2" color="error" role="alert">
            {formError}
          </Typography>
        )}

        <Button
          type="submit"
          variant="contained"
          color="success"
          disabled={submitting || username.trim().length < 3 || password.length < 8}
          startIcon={
            submitting ? (
              <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
            ) : null
          }
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </Box>
    </PageLayout>
  );
};

export default InviteAccept;
