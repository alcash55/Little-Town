import { Box, Button, Stack, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { Link as RouterLink } from 'react-router-dom';
import { appColors } from '../../../layout/Theme';
import { InvalidReason } from './useInviteAccept';

const REASON_CONTENT: Record<
  InvalidReason,
  { icon: JSX.Element; title: string; description: string }
> = {
  expired: {
    icon: <AccessTimeIcon fontSize="inherit" />,
    title: 'This invite has expired',
    description: 'Ask whoever sent it to generate a new invite link.',
  },
  used: {
    icon: <CheckCircleOutlineIcon fontSize="inherit" />,
    title: 'This invite has already been used',
    description:
      'It looks like an account was already created with this link. If that was you, log in instead.',
  },
  revoked: {
    icon: <BlockIcon fontSize="inherit" />,
    title: 'This invite was revoked',
    description: 'An admin cancelled this link. Ask them to generate a new one.',
  },
  unknown: {
    icon: <LinkOffIcon fontSize="inherit" />,
    title: "This invite link isn't valid",
    description: 'Double check the link you were given, or ask for a new one.',
  },
};

interface Props {
  reason: InvalidReason;
  onOpenLogin: () => void;
}

/**
 * Reason-specific empty state for a dead invite token — mirrors the icon +
 * message + action pattern used by Pages/Unauthorized (LockOutlined, muted
 * body text, outlined action buttons) rather than a bare error string.
 */
const InviteInvalidState = ({ reason, onOpenLogin }: Props) => {
  const content = REASON_CONTENT[reason];

  return (
    <>
      <Box sx={{ color: appColors.textSecondary, fontSize: 64 }}>{content.icon}</Box>
      <Typography variant="h2" sx={{ fontSize: 24, textAlign: 'center' }}>
        {content.title}
      </Typography>
      <Typography variant="body1" sx={{ textAlign: 'center', color: appColors.textSecondary }}>
        {content.description}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', alignItems: 'center' }}>
        {reason === 'used' && (
          <Button variant="outlined" color="success" onClick={onOpenLogin}>
            Log In
          </Button>
        )}
        <Button variant="outlined" color="success" component={RouterLink} to="/">
          Go Home
        </Button>
      </Stack>
    </>
  );
};

export default InviteInvalidState;
