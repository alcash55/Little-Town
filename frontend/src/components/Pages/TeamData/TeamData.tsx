import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { useTeamData, PlayerProgress } from './useTeamData';

// ── Shared style tokens (mirrors teamDrafterStyles) ──────────────────────────
const textPrimary = '#fff';
const textSecondary = 'rgba(255,255,255,0.72)';
const mutedText = 'rgba(255,255,255,0.45)';
const cardSx = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: textPrimary,
  width: '100%',
};
const accentGreen = '#2A9D8F';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

function formatDelta(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// Top-N deltas to show per player (keeps cards compact)
const TOP_N = 5;

function topDeltas(deltas: Record<string, number>): [string, number][] {
  return Object.entries(deltas)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_N);
}

// ── Player card ───────────────────────────────────────────────────────────────

function PlayerCard({ player }: { player: PlayerProgress }) {
  const skillTop = topDeltas(player.skillDeltas);
  const actTop = topDeltas(player.activityDeltas);
  const hasProgress = skillTop.length > 0 || actTop.length > 0;

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: player.isCaptain
          ? 'rgba(255,214,0,0.35)'
          : 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        flex: '1 1 220px',
        minWidth: 200,
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        {/* Player name + captain badge */}
        <Stack direction="row" alignItems="center" spacing={0.75} mb={1}>
          {player.isCaptain && (
            <Tooltip title="Team Captain">
              <StarIcon sx={{ fontSize: 14, color: '#FFD700' }} />
            </Tooltip>
          )}
          <Typography
            variant="body1"
            sx={{ color: textPrimary, fontWeight: 600, wordBreak: 'break-word' }}
          >
            {player.rsn}
          </Typography>
        </Stack>

        {/* Snapshot timestamp */}
        {player.snapshotTakenAt && (
          <Typography variant="caption" sx={{ color: mutedText, display: 'block', mb: 1 }}>
            Updated {fmt(player.snapshotTakenAt)}
          </Typography>
        )}

        {!hasProgress ? (
          <Typography variant="body2" sx={{ color: mutedText, fontStyle: 'italic' }}>
            No progress yet
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {skillTop.length > 0 && (
              <>
                <Typography variant="caption" sx={{ color: mutedText, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Skills
                </Typography>
                {skillTop.map(([name, xp]) => (
                  <Stack key={name} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ color: textSecondary, fontSize: 12 }}>
                      {name}
                    </Typography>
                    <Chip
                      label={`+${formatDelta(xp)} xp`}
                      size="small"
                      sx={{ bgcolor: 'rgba(42,157,143,0.15)', color: accentGreen, fontSize: 11, height: 20 }}
                    />
                  </Stack>
                ))}
              </>
            )}
            {actTop.length > 0 && (
              <>
                <Typography variant="caption" sx={{ color: mutedText, textTransform: 'uppercase', letterSpacing: '0.05em', mt: 0.5 }}>
                  Activities
                </Typography>
                {actTop.map(([name, kc]) => (
                  <Stack key={name} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ color: textSecondary, fontSize: 12 }}>
                      {name}
                    </Typography>
                    <Chip
                      label={`+${kc}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(255,214,0,0.10)', color: '#FFD600', fontSize: 11, height: 20 }}
                    />
                  </Stack>
                ))}
              </>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TeamData = () => {
  const { data, loading, error, lastUpdated, refresh } = useTeamData();

  return (
    <PageLayout title="Team Data" maxWidth="full">

      {/* Header row */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        width="100%"
        gap={1}
      >
        <Stack spacing={0.25}>
          {data && (
            <Typography variant="body2" sx={{ color: textSecondary }}>
              {data.bingoName} · {fmt(data.startDate)} → {fmt(data.endDate)}
            </Typography>
          )}
          {lastUpdated && (
            <Typography variant="caption" sx={{ color: mutedText }}>
              Last fetched {fmt(lastUpdated.toISOString())}
            </Typography>
          )}
        </Stack>

        <Tooltip title="Refresh team data">
          <span>
            <IconButton
              onClick={refresh}
              disabled={loading}
              sx={{ color: accentGreen, border: `1px solid rgba(42,157,143,0.4)`, borderRadius: 2 }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: accentGreen }} />
              ) : (
                <SyncIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, width: '100%' }}>
          <CircularProgress sx={{ color: accentGreen }} />
        </Box>
      )}

      {/* No active bingo */}
      {!loading && !error && !data && (
        <Typography sx={{ color: textSecondary, textAlign: 'center', width: '100%', mt: 4 }}>
          No active bingo found. Check back once one has started!
        </Typography>
      )}

      {/* Team cards */}
      {data?.teams.map((team) => (
        <Card key={team.teamId ?? 'unassigned'} sx={cardSx}>
          <CardHeader
            avatar={<TrendingUpIcon sx={{ color: accentGreen }} />}
            title={
              <Typography variant="h3" sx={{ fontSize: 18, color: textPrimary, fontWeight: 600 }}>
                {team.teamName}
              </Typography>
            }
            subheader={
              <Typography variant="caption" sx={{ color: mutedText }}>
                {team.players.length} player{team.players.length !== 1 ? 's' : ''}
              </Typography>
            }
          />
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <CardContent>
            {team.players.length === 0 ? (
              <Typography variant="body2" sx={{ color: mutedText }}>
                No players on this team yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {team.players.map((player) => (
                  <PlayerCard key={player.rsn} player={player} />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      ))}

    </PageLayout>
  );
};

export default TeamData;
