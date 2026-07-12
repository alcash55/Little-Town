import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BarChartIcon from '@mui/icons-material/BarChart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { appColors } from '../../../layout/Theme';
import { OnboardingProfile } from '../useOnboardingProfile';

interface Props {
  profile: OnboardingProfile;
  /** Called before navigating away mid-wizard — closes it the same way Skip does. */
  onNavigateAway: () => void;
}

const TeamStep = ({ profile, onNavigateAway }: Props) => {
  const navigate = useNavigate();
  const { loading, teamName } = profile;

  const go = (path: string) => {
    onNavigateAway();
    navigate(path);
  };

  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
      <Typography variant="h6" sx={{ color: appColors.textPrimary }}>
        Your team
      </Typography>

      {loading ? (
        <CircularProgress size={28} sx={{ color: appColors.accent }} />
      ) : (
        <Typography variant="body1" sx={{ color: appColors.accent, fontWeight: 600 }}>
          {teamName ?? "You're not on a team yet"}
        </Typography>
      )}

      <Typography variant="body2" sx={{ color: appColors.textSecondary, maxWidth: 380 }}>
        Track your team's board progress on Team Data, and see how every team stacks up on Bingo
        Scores.
      </Typography>

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<BarChartIcon />}
          onClick={() => go('/TeamData')}
          sx={{ color: appColors.accent, borderColor: appColors.accent }}
        >
          Team Data
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EmojiEventsIcon />}
          onClick={() => go('/BingoScores')}
          sx={{ color: appColors.accent, borderColor: appColors.accent }}
        >
          Bingo Scores
        </Button>
      </Stack>
    </Stack>
  );
};

export default TeamStep;
