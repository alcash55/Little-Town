import { Alert, Button, Card, CardContent, CircularProgress, Tooltip, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { appColors } from '../../../../layout/Theme';
import { textPrimary, textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { MaintenanceJob, MaintenanceJobResult } from './useMaintenance';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Visible disabled styling for outlined buttons against the dark card —
 * mirrors ScreenshotCard's disabledOutlinedSx. */
const disabledOutlinedSx = {
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,0.38)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
};

export type MaintenanceJobCardProps = {
  job: MaintenanceJob;
  running: boolean;
  result?: MaintenanceJobResult;
  onRun: () => void;
  onDismissResult: () => void;
  /** Set when the job can't be run right now (e.g. no active bingo) — the
   * button stays disabled and the reason shows on hover/focus. */
  disabledReason?: string;
};

export function MaintenanceJobCard({
  job,
  running,
  result,
  onRun,
  onDismissResult,
  disabledReason,
}: MaintenanceJobCardProps) {
  const isDisabled = running || !!disabledReason;

  return (
    <Card sx={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1 }}>
        <Typography variant="h3" sx={{ fontSize: 18, color: textPrimary }}>
          {job.name}
        </Typography>
        <Typography variant="body2" sx={{ color: textSecondary }}>
          {job.description}
        </Typography>

        <Tooltip title={disabledReason ?? ''} disableHoverListener={!disabledReason} arrow>
          <span style={{ alignSelf: 'flex-start' }}>
            <Button
              variant="outlined"
              disabled={isDisabled}
              onClick={onRun}
              aria-busy={running}
              startIcon={
                running ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SyncIcon />
              }
              sx={{
                color: appColors.accent,
                borderColor: appColors.accent,
                '&:hover': { borderColor: appColors.accent, bgcolor: 'rgba(42,157,143,0.08)' },
                ...disabledOutlinedSx,
              }}
            >
              {running ? 'Running…' : 'Run'}
            </Button>
          </span>
        </Tooltip>

        {result && (
          <Alert severity={result.status === 'success' ? 'success' : 'error'} onClose={onDismissResult}>
            <Typography variant="body2">{result.message}</Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, mt: 0.25 }}>
              {fmt(result.at)}
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
