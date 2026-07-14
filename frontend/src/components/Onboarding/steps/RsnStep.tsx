import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { appColors } from '../../../layout/Theme';
import { OnboardingProfile } from '../useOnboardingProfile';
import { RsnConfirmation, SOFT_PASS_AFTER_FAILURES } from '../useRsnConfirmation';

interface Props {
  profile: OnboardingProfile;
  rsn: RsnConfirmation;
}

/**
 * "Confirm your RuneScape name" (TEAM-BRIEF.md Track A #2). A typed
 * Autocomplete over the team roster replaces the old "spot your name among
 * these chips" — picking (or typing, since `freeSolo`) a name validates it
 * against the real OSRS hiscores via the public `GET /api/hiscores/:player`
 * proxy. NEXT is gated on `rsn.confirmed` (owned by the wizard via
 * useRsnConfirmation) in three ways:
 *  - a hiscores 200 for the picked name,
 *  - the user explicitly continuing unverified after repeated service
 *    failures (never after a clean 404 — that's the check working), or
 *  - there being nothing to confirm at all (no roster, or the roster fetch
 *    itself failed) — see `cannotConfirm`/`rosterEmpty` below.
 */
const RsnStep = ({ profile, rsn }: Props) => {
  const { loading, error, rsns, teamId } = profile;
  const { selected, status, failures, commit, retry, softPass } = rsn;

  const rosterEmpty = !loading && !error && !teamId && rsns.length === 0;

  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
      <Typography variant="h6" sx={{ color: appColors.textPrimary }}>
        Confirm your RuneScape name
      </Typography>

      {loading && <CircularProgress size={28} sx={{ color: appColors.accent }} />}

      {/* The team-roster fetch itself failed — nothing to build a picker
          from, so this is treated the same as an empty roster below:
          explain and let the user through rather than blocking onboarding
          on it. */}
      {!loading && error && (
        <Alert severity="warning" sx={{ width: '100%', maxWidth: 380 }}>
          Couldn't load your team roster right now ({error}). That's alright — RSNs are managed
          separately by admins in Team Drafter, so go ahead and continue.
        </Alert>
      )}

      {/* No team yet — blocking a team-less user on this step forever would
          be worse than explaining and letting them through. */}
      {!loading && !error && rosterEmpty && (
        <Alert severity="info" sx={{ width: '100%', maxWidth: 380 }}>
          We don't see a registered RuneScape name for you yet on the active bingo — there's nothing
          to confirm here. Admins add players in Team Drafter; reach out on Discord once you're
          rostered.
        </Alert>
      )}

      {!loading && !error && !rosterEmpty && (
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          <Typography variant="body2" sx={{ color: appColors.textSecondary, mb: 1.5 }}>
            Pick your name from your team's roster below, or type it if it's not listed:
          </Typography>

          <Autocomplete
            freeSolo
            autoSelect
            options={rsns}
            value={selected}
            onChange={(_e, newValue) => commit(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Your RSN"
                placeholder="Start typing your RuneScape name"
                error={status === 'invalid'}
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps.input,
                    endAdornment: (
                      <>
                        {status === 'validating' && (
                          <CircularProgress size={16} sx={{ color: appColors.accent, mr: 1 }} />
                        )}
                        {status === 'valid' && (
                          <CheckCircleOutlineIcon
                            fontSize="small"
                            sx={{ color: 'success.main', mr: 0.5 }}
                          />
                        )}
                        {status === 'invalid' && (
                          <ErrorOutlineIcon
                            fontSize="small"
                            sx={{ color: 'error.main', mr: 0.5 }}
                          />
                        )}
                        {params.slotProps.input.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />

          <Box sx={{ mt: 1.5, textAlign: 'left' }} role="status" aria-live="polite">
            {status === 'valid' && (
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center', color: 'success.main' }}
              >
                <CheckCircleOutlineIcon fontSize="small" />
                <Typography variant="caption">Confirmed on the OSRS hiscores.</Typography>
              </Stack>
            )}

            {status === 'invalid' && (
              <Alert severity="error" icon={<ErrorOutlineIcon fontSize="small" />}>
                "{selected}" wasn't found on the OSRS hiscores. Check the spelling, or pick a
                different name from the roster.
              </Alert>
            )}

            {status === 'down' && (
              <Stack spacing={1}>
                <Alert severity="warning">
                  Couldn't reach the OSRS hiscores to verify "{selected}"
                  {failures > 1 ? ` (attempt ${failures})` : ''}.
                </Alert>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={retry} sx={{ color: appColors.accent }}>
                    Retry
                  </Button>
                  {failures >= SOFT_PASS_AFTER_FAILURES && (
                    <Button size="small" onClick={softPass} sx={{ color: appColors.accent }}>
                      Continue without verifying
                    </Button>
                  )}
                </Stack>
              </Stack>
            )}

            {status === 'soft-passed' && (
              <Alert severity="info">
                Continuing without hiscores verification — the hiscores lookup kept failing, not
                your name. You can always sort out a mismatch later via Team Drafter.
              </Alert>
            )}
          </Box>
        </Box>
      )}

      <Typography variant="caption" sx={{ color: appColors.mutedText, maxWidth: 380 }}>
        Name missing or wrong? RSNs are managed by admins in Team Drafter — ping one on Discord, or
        check{' '}
        <MuiLink component={RouterLink} to="/TeamData" sx={{ color: appColors.accent }}>
          Team Data
        </MuiLink>{' '}
        for the full picture.
      </Typography>
    </Stack>
  );
};

export default RsnStep;
