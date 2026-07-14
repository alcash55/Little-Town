import { useMemo } from 'react';
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
import BlockIcon from '@mui/icons-material/Block';
import { Link as RouterLink } from 'react-router-dom';
import { appColors } from '../../../layout/Theme';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import { OnboardingProfile } from '../useOnboardingProfile';
import { RsnConfirmation, SOFT_PASS_AFTER_FAILURES, filterAccountDerivedRsns } from '../useRsnConfirmation';

interface Props {
  profile: OnboardingProfile;
  rsn: RsnConfirmation;
}

/**
 * "Confirm your RuneScape name" (TEAM-BRIEF.md Sprint 11 Track B).
 *
 * This is always a typed textbox — a free-text Autocomplete the user types
 * their real RSN into. It is never prefilled or defaulted from the signed-in
 * account (`selected` starts `null` and is only ever set by the user's own
 * input or by the server's canonical response), and any roster-sourced
 * suggestion that happens to match the account's username/nickname is
 * stripped before it reaches `options` (`filterAccountDerivedRsns` — see its
 * doc comment for the root cause this guards against). Roster suggestions
 * are a convenience only; committing a value always calls the real
 * `POST /api/onboarding/rsn` claim endpoint, and NEXT is gated on
 * `rsn.confirmed` (owned by the wizard via useRsnConfirmation):
 *  - a 200 claim response for the typed name, or
 *  - the user explicitly continuing unverified after repeated claim-service
 *    failures (never after a clean 422/409 — those are the check working).
 *
 * Unlike the previous version, a team-less/roster-less user is no longer
 * waved through without typing anything — self-claiming an RSN via this
 * step is now how a brand-new user actually gets themselves into the Team
 * Drafter pool (frozen contract: "created if absent, no team assigned"), so
 * the input stays available and required regardless of roster state.
 */
const RsnStep = ({ profile, rsn }: Props) => {
  const { user } = useLoginModal();
  const { loading, error, rsns, teamId } = profile;
  const { selected, status, failures, alreadyTracked, commit, retry, softPass } = rsn;

  // Never surfaces the signed-in user's own username/nickname as a
  // suggestion, even if a stray/mistaken roster row happens to match one.
  const suggestions = useMemo(() => filterAccountDerivedRsns(rsns, user), [rsns, user]);

  const noRosterYet = !loading && !error && !teamId && rsns.length === 0;

  return (
    <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
      <Typography variant="h6" sx={{ color: appColors.textPrimary }}>
        Confirm your RuneScape name
      </Typography>

      {loading && <CircularProgress size={28} sx={{ color: appColors.accent }} />}

      {!loading && (
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          {/* The team-roster fetch failed — nothing to build suggestions
              from, but typing/claiming an RSN doesn't depend on it, so this
              is informational only rather than blocking the input. */}
          {error && (
            <Alert severity="warning" sx={{ width: '100%', mb: 1.5 }}>
              Couldn't load your team roster for suggestions ({error}) — you can still type your
              RSN below.
            </Alert>
          )}

          {/* No team/roster yet — explain, but still let them claim their
              RSN below; that's exactly what registers them into the pool. */}
          {!error && noRosterYet && (
            <Alert severity="info" sx={{ width: '100%', mb: 1.5 }}>
              We don't see a team roster for you yet on the active bingo — that's fine, type your
              real RuneScape name below and we'll get it tracked.
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: appColors.textSecondary, mb: 1.5 }}>
            Type your real RuneScape name{suggestions.length > 0 ? ', or pick it below if it’s already listed' : ''}:
          </Typography>

          <Autocomplete
            freeSolo
            autoSelect
            options={suggestions}
            value={selected}
            onChange={(_e, newValue) => commit(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Your RSN"
                placeholder="Start typing your RuneScape name"
                error={status === 'invalid' || status === 'taken'}
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
                        {(status === 'invalid' || status === 'taken') && (
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
                <Typography variant="caption">
                  {alreadyTracked
                    ? 'Already tracked — confirmed and up to date.'
                    : "Confirmed on the OSRS hiscores and you're now tracked in the player pool."}
                </Typography>
              </Stack>
            )}

            {status === 'invalid' && (
              <Alert severity="error" icon={<ErrorOutlineIcon fontSize="small" />}>
                "{selected}" wasn't found on the OSRS hiscores. Check the spelling and try again.
              </Alert>
            )}

            {status === 'taken' && (
              <Alert severity="error" icon={<BlockIcon fontSize="small" />}>
                "{selected}" is already claimed by a different account. If that's you under
                another login, reach out to an admin on Discord.
              </Alert>
            )}

            {status === 'down' && (
              <Stack spacing={1}>
                <Alert severity="warning">
                  Couldn't reach the RSN tracking service to confirm "{selected}"
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
                Continuing without verification — the tracking service kept failing, not your
                name. You can always sort out a mismatch later via Team Drafter.
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
