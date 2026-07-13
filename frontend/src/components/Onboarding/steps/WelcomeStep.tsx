import { Stack, Typography } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { appColors } from '../../../layout/Theme';

const WelcomeStep = () => (
  <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
    <EmojiEventsIcon sx={{ fontSize: 48, color: appColors.accent }} />
    <Typography variant="h6" sx={{ color: appColors.textPrimary }}>
      What is Little Town Bingo?
    </Typography>
    <Typography variant="body2" sx={{ color: appColors.textSecondary, maxWidth: 420 }}>
      Little Town Bingo is a team OSRS event — your team races to complete tiles on a shared
      board by hitting XP and kill-count goals, or by submitting drop screenshots for admin
      review. This quick tour points you at your team, where to check scores, and where to find
      tips before you start.
    </Typography>
  </Stack>
);

export default WelcomeStep;
