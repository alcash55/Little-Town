import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { appColors } from '../../../../layout/Theme';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { PlayerConflict } from './useBingoOverview';

const fmtRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleDateString(undefined, dateOpts)} ${start.toLocaleTimeString(undefined, timeOpts)} → ${end.toLocaleDateString(undefined, dateOpts)} ${end.toLocaleTimeString(undefined, timeOpts)}`;
};

const ConflictCard = ({ conflict }: { conflict: PlayerConflict }) => {
  const isHigh = conflict.severity === 'high';

  return (
    <Card
      sx={{
        width: '100%',
        borderLeft: '3px solid',
        borderLeftColor: isHigh ? 'error.main' : 'warning.main',
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}
        >
          {isHigh ? (
            <ErrorIcon fontSize="small" sx={{ color: 'error.main' }} />
          ) : (
            <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />
          )}
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {conflict.rsn} <Typography component="span" sx={{ color: textSecondary }}>×</Typography>{' '}
            {conflict.sideRsn}
          </Typography>
          <Chip
            label={isHigh ? 'High severity' : 'Low severity'}
            size="small"
            sx={{
              bgcolor: isHigh ? 'rgba(211,47,47,0.16)' : 'rgba(255,167,38,0.16)',
              color: isHigh ? 'error.main' : 'warning.main',
              fontWeight: 600,
            }}
          />
        </Stack>
        <Typography variant="caption" sx={{ color: textSecondary, display: 'block', mb: 1 }}>
          Main and side account both gained XP during {conflict.windows.length} overlapping
          window{conflict.windows.length !== 1 ? 's' : ''}.
        </Typography>
        <Stack spacing={0.75}>
          {conflict.windows.map((w, i) => (
            <Stack
              key={i}
              direction="row"
              spacing={1.5}
              sx={{
                alignItems: 'center',
                flexWrap: 'wrap',
                fontSize: 13,
                color: appColors.textPrimary,
                bgcolor: 'rgba(255,255,255,0.04)',
                borderRadius: 1,
                px: 1,
                py: 0.5,
              }}
            >
              <Typography variant="body2" sx={{ color: textSecondary, minWidth: 210 }}>
                {fmtRange(w.start, w.end)}
              </Typography>
              <Typography variant="body2">
                {conflict.rsn}: +{w.mainXpGained.toLocaleString()} xp
              </Typography>
              <Typography variant="body2">
                {conflict.sideRsn}: +{w.sideXpGained.toLocaleString()} xp
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export type ConflictsSectionProps = {
  conflicts: PlayerConflict[];
  conflictsError: string | null;
};

/**
 * Side-account conflict detection. Empty state is a positive, explicit
 * treatment (not a bare blank) — the absence of conflicts is good news and
 * should read that way, same pattern as ScreenshotSubmission's "All caught
 * up" empty state.
 */
export const ConflictsSection = ({ conflicts, conflictsError }: ConflictsSectionProps) => {
  if (conflictsError) {
    return (
      <Alert severity="warning" sx={{ width: '100%' }}>
        {conflictsError}
      </Alert>
    );
  }

  if (conflicts.length === 0) {
    return (
      <Stack
        spacing={1}
        sx={{
          alignItems: 'center',
          textAlign: 'center',
          width: '100%',
          py: 4,
          color: textSecondary,
        }}
      >
        <VerifiedUserIcon sx={{ fontSize: 44, color: appColors.accent }} />
        <Typography variant="body1" sx={{ fontWeight: 600, color: appColors.textPrimary }}>
          No conflicts detected
        </Typography>
        <Typography variant="body2" sx={{ color: textSecondary, maxWidth: 380 }}>
          No overlapping XP gains found between any player&apos;s main and side accounts.
        </Typography>
      </Stack>
    );
  }

  const highCount = conflicts.filter((c) => c.severity === 'high').length;

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="body2" sx={{ color: textSecondary, mb: 1.5 }}>
        {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
        {highCount > 0 ? `, ${highCount} high severity` : ''}.
      </Typography>
      <Stack spacing={1.5}>
        {conflicts.map((c) => (
          <ConflictCard key={`${c.playerId}-${c.sideRsn}`} conflict={c} />
        ))}
      </Stack>
    </Box>
  );
};
