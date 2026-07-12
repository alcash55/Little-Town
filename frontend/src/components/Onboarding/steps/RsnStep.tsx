import { Alert, Chip, CircularProgress, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { appColors } from '../../../layout/Theme';
import { OnboardingProfile } from '../useOnboardingProfile';

interface Props {
  profile: OnboardingProfile;
}

/**
 * "Confirm your RuneScape name" per the brief's assumed scope. The
 * `my-team-data` contract has no field marking which roster row belongs to
 * the viewer (see useOnboardingProfile's comment) — so rather than guess
 * wrong, this shows the whole roster and asks the user to spot their own
 * name, instead of definitively claiming "this one is you".
 */
const RsnStep = ({ profile }: Props) => {
  const { loading, error, rsns, teamId } = profile;

  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
      <Typography variant="h6" sx={{ color: appColors.textPrimary }}>
        Confirm your RuneScape name
      </Typography>

      {loading && <CircularProgress size={28} sx={{ color: appColors.accent }} />}

      {!loading && error && (
        <Alert severity="warning" sx={{ width: '100%', maxWidth: 380 }}>
          Couldn't load your registration right now: {error}
        </Alert>
      )}

      {!loading && !error && !teamId && rsns.length === 0 && (
        <Typography variant="body2" sx={{ color: appColors.textSecondary, maxWidth: 380 }}>
          We don't see a registered RuneScape name for you yet on the active bingo. Admins add
          players in Team Drafter — reach out on Discord if that looks wrong.
        </Typography>
      )}

      {!loading && !error && (teamId || rsns.length > 0) && (
        <>
          <Typography variant="body2" sx={{ color: appColors.textSecondary, maxWidth: 380 }}>
            Here's the roster registered on your team — find your name below:
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center', rowGap: 1 }}>
            {rsns.map((rsn) => (
              <Chip
                key={rsn}
                label={rsn}
                size="small"
                sx={{ bgcolor: 'rgba(42,157,143,0.15)', color: appColors.accent }}
              />
            ))}
          </Stack>
        </>
      )}

      <Typography variant="caption" sx={{ color: appColors.mutedText, maxWidth: 380 }}>
        Name missing or wrong? RSNs are managed by admins in Team Drafter — ping one on Discord,
        or check{' '}
        <MuiLink component={RouterLink} to="/TeamData" sx={{ color: appColors.accent }}>
          Team Data
        </MuiLink>{' '}
        for the full picture.
      </Typography>
    </Stack>
  );
};

export default RsnStep;
