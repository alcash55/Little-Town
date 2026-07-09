import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupsIcon from '@mui/icons-material/Groups';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import StarIcon from '@mui/icons-material/Star';
import SyncIcon from '@mui/icons-material/Sync';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { Countdown } from '../../../Countdown/Countdown';
import { useBingoOverview } from './useBingoOverview';
import { BingoTeam, BingoPlayer } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

// ─── Info Row ────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Stack direction="row" alignItems="center" spacing={1.5}>
    <Box sx={{ color: '#2A9D8F', display: 'flex' }}>{icon}</Box>
    <Typography variant="body2" sx={{ minWidth: 110 }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
  </Stack>
);

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <Card sx={{ flex: 1, minWidth: 130 }}>
    <CardContent sx={{ pb: '12px !important' }}>
      <Typography variant="body2" sx={{ mb: 0.5 }}>{label}</Typography>
      <Typography variant="h5" sx={{ fontFamily: "'pacifico', cursive" }}>{value}</Typography>
      {sub && <Typography variant="caption">{sub}</Typography>}
    </CardContent>
  </Card>
);

// ─── Team Roster ─────────────────────────────────────────────────────────────
const TeamRoster = ({ teams, players }: { teams: BingoTeam[]; players: BingoPlayer[] }) => {
  if (teams.length === 0) return (
    <Typography variant="body2">No teams assigned yet.</Typography>
  );
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}>
      {teams.map(team => {
        const members = players.filter(p => p.team_id === team.id || p.captain_team_id === team.id);
        return (
          <Card key={team.id} sx={{ flex: '1 1 180px', minWidth: 180 }}>
            <CardHeader
              title={
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: 14 }}>
                  {team.name}
                </Typography>
              }
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ pt: 1, pb: '8px !important' }}>
              {members.length === 0 ? (
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>No players</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {members.map(p => {
                    const isCaptain = p.captain_team_id === team.id;
                    return (
                      <Stack key={p.rsn} direction="row" alignItems="center" spacing={0.75}>
                        {isCaptain && (
                          <Tooltip title="Captain">
                            <StarIcon sx={{ fontSize: 13, color: '#FFD700' }} />
                          </Tooltip>
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            // color: isCaptain ? textPrimary : textSecondary, 
                            fontWeight: isCaptain ? 600 : 400
                          }}
                        >
                          {p.rsn}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

// ─── Compact Board ───────────────────────────────────────────────────────────
const tileObjective = (tile: Tile): string => {
  if (tile.type === 'Kill Count') return `Kill ${tile.killCount}×`;
  if (tile.type === 'Experience') return `${tile.experience.toLocaleString()} xp`;
  return `${tile.dropsAmount} drop${tile.dropsAmount !== 1 ? 's' : ''}`;
};

const CompactBoard = ({ tiles, boardSize }: { tiles: Tile[]; boardSize: number }) => {
  const cols = boardSize === 35 ? 5 : 4;
  if (tiles.length === 0) return (
    <Typography variant="body2">Board not set up yet.</Typography>
  );
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 1,
        width: '100%',
      }}
    >
      {tiles.map((tile, i) => (
        <Tooltip
          key={i}
          title={
            <Stack spacing={0.25}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{tile.task}</Typography>
              <Typography variant="caption">{tile.type}</Typography>
              <Typography variant="caption">Obj: {tileObjective(tile)}</Typography>
              <Typography variant="caption">{tile.points} pts</Typography>
            </Stack>
          }
          arrow
        >
          <Box
            sx={{
              background: 'linear-gradient(135deg, #2A9D8F 0%, rgba(13,13,13,0.86) 100%)',
              borderRadius: 1,
              p: 0.75,
              cursor: 'default',
              minHeight: 54,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                // color: textPrimary,
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {tile.task}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 9 }}>
              {tile.points}pts
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
};


const BingoOverview = () => {
  const {
    bingo,
    teams,
    players,
    board,
    playerStats,
    playerStatsError,
    pendingScreenshots,
    loading,
    error,
    isActive,
    isPlanned,
    startingNow,
    startError,
    startNow,
    refreshingStats,
    refreshStatsMessage,
    clearRefreshStatsMessage,
    refreshAllStats,
    endDialogOpen,
    setEndDialogOpen,
    endConfirmName,
    setEndConfirmName,
    endNameMatches,
    ending,
    endError,
    endBingo,
  } = useBingoOverview();

  // Memoize parsed dates so Countdown's useEffect only re-fires on actual value changes
  // Must be before any early returns to satisfy the Rules of Hooks
  const startDateObj = useMemo(
    () => (bingo?.startDate ? new Date(bingo.startDate) : new Date()),
    [bingo?.startDate],
  );
  const endDateObj = useMemo(
    () => (bingo?.endDate ? new Date(bingo.endDate) : new Date()),
    [bingo?.endDate],
  );

  // ── Loading / error / empty states ──────────────────────────────────────
  if (loading) {
    return (
      <PageLayout title="Bingo Overview" align="center">
        <CircularProgress sx={{ color: '#2A9D8F' }} />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Bingo Overview">
        <Alert severity="error">{error}</Alert>
      </PageLayout>
    );
  }

  if (!bingo) {
    return (
      <PageLayout title="Bingo Overview" align="center">
        <Typography>
          No bingo has been set up yet. Head to Bingo Details to get started.
        </Typography>
      </PageLayout>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────
  const boardLabel = bingo.boardSize === 16 ? '4×4' : bingo.boardSize === 35 ? '5×5' : `${bingo.boardSize} tiles`;
  const totalPoints = playerStats.reduce((sum, p) => sum + p.totalPoints, 0);
  const tilesCompleted = playerStats.reduce((sum, p) => sum + p.tilesCompleted, 0);

  // ── Planned (pre-start) view ─────────────────────────────────────────────
  if (isPlanned) {
    return (
      <PageLayout title="Bingo Overview" maxWidth={700}>
        <Countdown targetDate={startDateObj} label="Time until the bingo" />

        <Card sx={{ width: '100%' }}>
          <CardHeader
            title={
              <Typography variant="h3" sx={{ fontSize: 22 }}>
                {bingo.name}
              </Typography>
            }
            subheader={
              <Chip
                label={bingo.status === 'planned' ? 'Upcoming' : bingo.status ?? 'Draft'}
                size="small"
                sx={{
                  bgcolor: bingo.status === 'planned'
                    ? 'rgba(255, 214, 0, 0.15)'
                    : 'rgba(255, 140, 0, 0.15)',
                  color: bingo.status === 'planned' ? '#FFD600' : '#FF8C00',
                  textTransform: 'capitalize',
                }}
              />
            }
            subheaderTypographyProps={{ py: 1.5 }}
          />

          <CardContent>
            <Stack spacing={1.5} divider={<Divider />}>
              <InfoRow icon={<CalendarTodayIcon fontSize="small" />} label="Starts" value={fmt(bingo.startDate)} />
              <InfoRow icon={<CalendarTodayIcon fontSize="small" />} label="Ends" value={fmt(bingo.endDate)} />
              <InfoRow icon={<EmojiEventsIcon fontSize="small" />} label="Board" value={boardLabel} />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ width: '100%' }}>
          <CardHeader
            avatar={<GroupsIcon sx={{ color: '#2A9D8F' }} />}
            title={<Typography variant="h3" sx={{ fontSize: 18 }}>Teams</Typography>}
          />
          <CardContent sx={{ pt: 0 }}>
            <TeamRoster teams={teams} players={players} />
          </CardContent>
        </Card>

        <Card sx={{ width: '100%' }}>
          <CardHeader
            avatar={<EmojiEventsIcon sx={{ color: '#2A9D8F' }} />}
            title={<Typography variant="h3" sx={{ fontSize: 18 }}>Planned Board</Typography>}
            subheader={<Typography variant="body2">{boardLabel}</Typography>}
          />
          <CardContent sx={{ pt: 0 }}>
            <CompactBoard tiles={board} boardSize={bingo.boardSize} />
          </CardContent>
        </Card>


        {startError && <Alert severity="error" sx={{ width: '100%' }}>{startError}</Alert>}

        <Button
          variant="outlined"
          color="success"
          disabled={startingNow}
          startIcon={startingNow ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined}
          onClick={startNow}
          sx={{ alignSelf: 'center' }}
        >
          {startingNow ? 'Starting…' : 'Start Bingo Now'}
        </Button>
      </PageLayout>
    );
  }

  // ── Active bingo dashboard ───────────────────────────────────────────────
  return (
    <PageLayout title="Bingo Overview" maxWidth="full">

      {/* ── Stats refresh feedback ── */}
      {refreshStatsMessage && (
        <Alert
          severity={refreshStatsMessage.startsWith('Failed') ? 'error' : 'success'}
          onClose={clearRefreshStatsMessage}
          sx={{ width: '100%' }}
        >
          {refreshStatsMessage}
        </Alert>
      )}

      {/* ── Pending screenshots alert ── */}
      {pendingScreenshots.length > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          action={
            <Button size="small" color="inherit" href="/AdminPanel/ScreenshotSubmission">
              Review
            </Button>
          }
          sx={{ width: '100%' }}
        >
          {pendingScreenshots.length} screenshot{pendingScreenshots.length > 1 ? 's' : ''} pending review
        </Alert>
      )}

      {/* ── Player stats load failure (distinct from the fatal page error above) ── */}
      {playerStatsError && (
        <Alert severity="warning" sx={{ width: '100%' }}>
          {playerStatsError}
        </Alert>
      )}

      {/* ── Summary stat cards ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}>
        <StatCard label="Bingo" value={bingo.name} />
        <StatCard label="Ends" value={fmt(bingo.endDate)} />
        <StatCard label="Tiles Completed" value={tilesCompleted} />
        <StatCard label="Total Points Scored" value={totalPoints} />
        <StatCard label="Players" value={players.length} />
      </Box>

      {/* ── Player stats table ── */}
      <Card sx={{ width: '100%' }}>
        <CardHeader
          title={<Typography variant="h3" sx={{ fontSize: 18 }}>Player Stats</Typography>}
        />
        <CardContent sx={{ p: 0 }}>
          {playerStats.length === 0 ? (
            <Typography sx={{ p: 2 }}>No player data yet.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Player', 'Team', 'Tiles', 'Points', 'Last Seen', 'Side Accounts'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {playerStats.map(p => (
                    <TableRow key={p.rsn}>
                      <TableCell>
                        <Typography variant="body2">{p.rsn}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{p.teamName}</Typography>
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
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {p.sideAccounts.map(acc => (
                              <Chip key={acc} label={acc} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
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
          )}
        </CardContent>
      </Card>

      {/* ── Time remaining ── */}
      <Card sx={{ width: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <AccessTimeIcon sx={{ color: '#2A9D8F' }} />
            <Typography variant="h3" sx={{ fontSize: 18 }}>Time Remaining</Typography>
          </Stack>
          <Countdown targetDate={endDateObj} label="" />
        </CardContent>
      </Card>

      {/* ── End bingo button ── */}
      <Stack direction="row" spacing={2} alignSelf="flex-end">
        <Button
          variant="outlined"
          disabled={refreshingStats}
          startIcon={refreshingStats ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SyncIcon />}
          onClick={refreshAllStats}
          sx={{ color: '#2A9D8F', borderColor: '#2A9D8F', '&:hover': { borderColor: '#2A9D8F', bgcolor: 'rgba(42,157,143,0.08)' } }}
        >
          {refreshingStats ? 'Refreshing…' : 'Refresh Player Stats'}
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() => setEndDialogOpen(true)}
        >
          End Bingo Early
        </Button>
      </Stack>

      {/* ── End bingo confirmation dialog ── */}
      <Dialog open={endDialogOpen} onClose={() => { setEndDialogOpen(false); setEndConfirmName(''); }} maxWidth="xs" fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#f44336', fontFamily: "'pacifico', cursive" }}>End Bingo Early?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">
              This will immediately end <strong>{bingo.name}</strong> and set the end time to now.
              This cannot be undone.
            </Typography>
            <Typography variant="body2">
              Type <strong>{bingo.name}</strong> to confirm.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              placeholder={bingo.name}
              value={endConfirmName}
              onChange={e => setEndConfirmName(e.target.value)}
              error={endConfirmName.length > 0 && !endNameMatches}
              helperText={endConfirmName.length > 0 && !endNameMatches ? 'Name does not match' : ' '}
              sx={{
                '& .MuiFormHelperText-root': { color: '#f44336' },
              }}
            />
            {endError && <Alert severity="error">{endError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, pb: 2 }}>
          <Button onClick={() => { setEndDialogOpen(false); setEndConfirmName(''); }}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={!endNameMatches || ending}
            startIcon={ending ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined}
            onClick={endBingo}
          >
            {ending ? 'Ending…' : 'End Bingo'}
          </Button>
        </DialogActions>
      </Dialog>

    </PageLayout>
  );
};

export default BingoOverview;
