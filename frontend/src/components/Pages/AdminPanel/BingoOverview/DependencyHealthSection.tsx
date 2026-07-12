import { Alert, Box, Card, CardContent, Stack, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { DependencyStatus, ServiceHealth } from './useBingoOverview';

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

// Status is a fixed, reserved palette — never reused for series/categorical
// color, always icon + label so state never rides on color alone. These are
// MUI's theme status colors (theme.tsx palette.mode: 'dark'), not new hex.
const STATUS_META: Record<
  DependencyStatus,
  { label: string; color: string; icon: typeof CheckCircleIcon }
> = {
  up: { label: 'Up', color: 'success.main', icon: CheckCircleIcon },
  degraded: { label: 'Degraded', color: 'warning.main', icon: WarningAmberIcon },
  down: { label: 'Down', color: 'error.main', icon: ErrorIcon },
  unknown: { label: 'Unknown', color: 'text.secondary', icon: HelpOutlineIcon },
};

const ServiceTile = ({ service }: { service: ServiceHealth }) => {
  const meta = STATUS_META[service.status];
  const Icon = meta.icon;

  return (
    <Card
      sx={{
        flex: '1 1 200px',
        minWidth: 200,
        borderLeft: '3px solid',
        borderLeftColor: meta.color,
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <Icon fontSize="small" sx={{ color: meta.color }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {service.label}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: meta.color, fontWeight: 600 }}>
          {meta.label}
          {typeof service.latencyMs === 'number' ? ` · ${service.latencyMs}ms` : ''}
        </Typography>
        <Tooltip title={service.detail ?? ''} disableHoverListener={!service.detail} arrow>
          <Typography
            variant="caption"
            sx={{
              color: textSecondary,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {service.detail ?? `Checked ${fmt(service.checkedAt)}`}
          </Typography>
        </Tooltip>
      </CardContent>
    </Card>
  );
};

export type DependencyHealthSectionProps = {
  health: ServiceHealth[];
  healthError: string | null;
};

/**
 * Dependency status — discrete states, not a magnitude, so this is status
 * tiles rather than a chart (per dataviz's "is it even a chart?" table).
 */
export const DependencyHealthSection = ({ health, healthError }: DependencyHealthSectionProps) => {
  if (healthError) {
    return (
      <Alert severity="warning" sx={{ width: '100%' }}>
        {healthError}
      </Alert>
    );
  }

  if (health.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: textSecondary, py: 2 }}>
        No dependency data yet.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}>
      {health.map((service) => (
        <ServiceTile key={service.id} service={service} />
      ))}
    </Box>
  );
};

