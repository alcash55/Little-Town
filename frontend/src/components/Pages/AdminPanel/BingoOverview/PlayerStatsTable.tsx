import {
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { PlayerStat } from './useBingoOverview';

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const HEADERS = ['Player', 'Team', 'Tiles', 'Points', 'Last Seen', 'Side Accounts'] as const;

export type PlayerStatsTableProps = {
  playerStats: PlayerStat[];
};

/**
 * Per-player table — kept a table, not a chart, per dataviz's form guidance:
 * more than a handful of rows that each individually carry meaning belongs in
 * a table (or table + chart), not more colors crammed into a plot.
 */
export const PlayerStatsTable = ({ playerStats }: PlayerStatsTableProps) => {
  if (playerStats.length === 0) {
    return (
      <Typography sx={{ p: 2, color: textSecondary }}>No player data yet.</Typography>
    );
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {HEADERS.map((h) => (
              <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {playerStats.map((p) => (
            <TableRow key={p.rsn}>
              <TableCell>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography variant="body2">{p.rsn}</Typography>
                  {p.rsnStale && (
                    <Tooltip
                      title={`RSN may have changed${
                        p.rsnStaleSince ? ` — last verified on ${fmt(p.rsnStaleSince)}` : ''
                      }. A hiscore lookup for this name recently failed.`}
                      arrow
                    >
                      <WarningAmberIcon
                        fontSize="small"
                        sx={{ color: 'warning.main' }}
                        aria-label="RSN may have changed"
                      />
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{p.teamName || '—'}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{p.tilesCompleted}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{p.totalPoints}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{fmt(p.lastSeen)}</Typography>
              </TableCell>
              <TableCell>
                {p.sideAccounts.length > 0 ? (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                    {p.sideAccounts.map((acc) => (
                      <Chip
                        key={acc}
                        label={acc}
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.08)' }}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2">—</Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};
