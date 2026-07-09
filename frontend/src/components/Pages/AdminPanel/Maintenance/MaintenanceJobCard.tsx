import { Alert, Button, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
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
};

export function MaintenanceJobCard({ job, running, result, onRun, onDismissResult }: MaintenanceJobCardProps) {
  return (
    <Card sx={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1 }}>
        <Typography variant="h3" sx={{ fontSize: 18, color: textPrimary }}>
          {job.name}
        </Typography>
        <Typography variant="body2" sx={{ color: textSecondary }}>
          {job.description}
        </Typography>

        <Button
          variant="outlined"
          disabled={running}
          onClick={onRun}
          aria-busy={running}
          startIcon={
            running ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SyncIcon />
          }
          sx={{
            alignSelf: 'flex-start',
            color: '#2A9D8F',
            borderColor: '#2A9D8F',
            '&:hover': { borderColor: '#2A9D8F', bgcolor: 'rgba(42,157,143,0.08)' },
            ...disabledOutlinedSx,
          }}
        >
          {running ? 'Running…' : 'Run'}
        </Button>

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
