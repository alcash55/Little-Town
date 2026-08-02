import { Box, Button, Typography } from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { appColors } from '../../../layout/Theme';
import { useOnboarding } from '../../Onboarding';

/**
 * TeamData's empty state when the caller's account isn't linked to any
 * player yet (`GET /my-team-data` comes back `teamId: null`,
 * `teamName: 'Unassigned'`, `players: []` — see useTeamData.ts).
 *
 * TEAM-BRIEF.md Sprint 17, Track B item 3 (the highest-value item in the
 * track): a real player who hasn't confirmed their RSN used to land here
 * with nothing but "Unassigned doesn't have any players yet." — indistinguishable
 * from "an admin forgot to draft a team named Unassigned", and zero indication
 * that reopening the onboarding wizard's RSN step is what fixes it. That
 * wizard already exists (Onboarding/OnboardingWizard.tsx) and is reachable
 * via "Show intro" in the sidebar footer — this callout is the second,
 * contextual entry point, right where a player actually notices something's
 * wrong.
 *
 * Deliberately a distinct branch from "my team is real but has 0 players"
 * (TeamData.tsx keys off `teamId === null`, not `players.length === 0`
 * alone) — those two states have different causes and different fixes, and
 * conflating them is the bug being fixed here.
 */
export function UnlinkedAccountCallout() {
  const { showIntro, canShowIntro } = useOnboarding();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        maxWidth: 460,
        mx: 'auto',
        mt: 4,
        textAlign: 'center',
      }}
    >
      <PersonSearchIcon sx={{ fontSize: 48, color: appColors.accent }} />
      <Typography variant="h3" sx={{ fontSize: 18, color: appColors.textPrimary }}>
        Your account isn&apos;t linked to a player yet
      </Typography>
      <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
        Confirming your RuneScape name is what links your account to your team — it&apos;s what
        lights up your board highlights and fills in this page.
      </Typography>
      {canShowIntro && (
        <Button
          variant="outlined"
          onClick={showIntro}
          sx={{
            mt: 0.5,
            color: appColors.accent,
            borderColor: appColors.accent,
            '&:hover': { borderColor: appColors.accent, bgcolor: 'rgba(42,157,143,0.08)' },
          }}
        >
          Confirm your RSN
        </Button>
      )}
    </Box>
  );
}
