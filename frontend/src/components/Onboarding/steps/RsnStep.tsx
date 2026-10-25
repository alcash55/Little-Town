import { useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import BlockIcon from '@mui/icons-material/Block';
import { appColors } from '../../../layout/Theme';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import { OnboardingProfile } from '../useOnboardingProfile';
import {
  RsnConfirmation,
  SOFT_PASS_AFTER_FAILURES,
  filterAccountDerivedRsns,
} from '../useRsnConfirmation';

interface Props {
  profile: OnboardingProfile;
  rsn: RsnConfirmation;
}

/**
 * Explicitly look up and connect the typed RSN. Editing and choosing a
 * suggestion never submit. Next is owned by the wizard and only advances
 * after a connection succeeds or the user explicitly accepts an outage skip.
 */
const RsnStep = ({ profile, rsn }: Props) => {
  const { user } = useLoginModal();
  const { loading, error, rsns } = profile;
  const { selected, status, failures, edit, commit, retry, softPass } = rsn;

  // Never surfaces the signed-in user's own username/nickname as a
  // suggestion, even if a stray/mistaken roster row happens to match one.
  const suggestions = useMemo(() => filterAccountDerivedRsns(rsns, user), [rsns, user]);

  const [highlighted, setHighlighted] = useState<string | null>(null);
  const findAndConnect = (name = selected) => {
    if (name?.trim() && status !== 'validating') commit(name);
  };

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
              Couldn't load your team roster for suggestions ({error}) — you can still type your RSN
              below.
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: appColors.textSecondary, mb: 1.5 }}>
            Type your real RuneScape name
            {suggestions.length > 0 ? ', or pick it below if it’s already listed' : ''}:
          </Typography>

          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              findAndConnect();
            }}
          >
            <Autocomplete
              freeSolo
              disabled={status === 'validating'}
              clearOnBlur={false}
              options={suggestions}
              value={selected}
              inputValue={selected ?? ''}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input' || reason === 'clear') {
                  setHighlighted(null);
                  edit(value);
                }
              }}
              onChange={(_event, value) => {
                setHighlighted(null);
                edit(value);
              }}
              onHighlightChange={(_event, option) => setHighlighted(option)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.defaultMuiPrevented = true;
                  event.preventDefault();
                  findAndConnect(highlighted ?? selected);
                }
              }}
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
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!selected?.trim() || status === 'validating'}
              sx={{
                mt: 1.5,
                bgcolor: appColors.accent,
                color: '#081b18',
                '&:hover': { bgcolor: appColors.accent },
              }}
            >
              {status === 'validating' ? 'Connecting...' : 'Find and connect'}
            </Button>
          </Box>

          <Box sx={{ mt: 1.5, textAlign: 'left' }} role="status" aria-live="polite">
            {status === 'valid' && (
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center', color: 'success.main' }}
              >
                <CheckCircleOutlineIcon fontSize="small" />
                <Typography variant="caption">
                  Your RuneScape name is connected to your account.
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
                "{selected}" is already claimed by a different account. If that's you under another
                login, ask a clan admin for help.
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
                Continuing without verification — the tracking service kept failing, not your name.
                You can always sort out a mismatch later via Team Drafter.
              </Alert>
            )}
          </Box>
        </Box>
      )}

      <Typography variant="caption" sx={{ color: appColors.mutedText, maxWidth: 380 }}>
        Use your current in-game name. If it's linked to another account, ask a clan admin for help.
      </Typography>
    </Stack>
  );
};

export default RsnStep;
