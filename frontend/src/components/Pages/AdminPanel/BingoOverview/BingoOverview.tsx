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
import LinkOffIcon from '@mui/icons-material/LinkOff';
import StarIcon from '@mui/icons-material/Star';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { Countdown } from '../../../Countdown/Countdown';
import { useBingoOverview } from './useBingoOverview';
import { BingoTeam, BingoPlayer } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';
import {
  cardSx,
  tableCellSx,
  textPrimary,
  textSecondary,
  mutedText,
  subtleBorder,
  outlinedButtonSx,
} from '../TeamDrafter/teamDrafterStyles';

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const minutesToHours = (m: number) => {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** Threshold above which playtime is flagged as suspicious (6 hours) */
const SUSPICIOUS_MINUTES = 360;

// ─── Info Row ────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Stack direction="row" alignItems="center" spacing={1.5}>
    <Box sx={{ color: '#2A9D8F', display: 'flex' }}>{icon}</Box>
    <Typography variant="body2" sx={{ color: textSecondary, minWidth: 110 }}>{label}</Typography>
    <Typography variant="body2" sx={{ color: textPrimary, fontWeight: 500 }}>{value}</Typography>
  </Stack>
);

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <Card sx={{ ...cardSx, flex: 1, minWidth: 130 }}>
    <CardContent sx={{ pb: '12px !important' }}>
      <Typography variant="body2" sx={{ color: mutedText, mb: 0.5 }}>{label}</Typography>
      <Typography variant="h5" sx={{ color: textPrimary, fontFamily: "'pacifico', cursive" }}>{value}</Typography>
      {sub && <Typography variant="caption" sx={{ color: mutedText }}>{sub}</Typography>}
    </CardContent>
  </Card>
);

// ─── Team Roster ─────────────────────────────────────────────────────────────
const TeamRoster = ({ teams, players }: { teams: BingoTeam[]; players: BingoPlayer[] }) => {
  if (teams.length === 0) return (
    <Typography variant="body2" sx={{ color: mutedText }}>No teams assigned yet.</Typography>
  );
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}>
      {teams.map(team => {
        const members = players.filter(p => p.team_id === team.id || p.captain_team_id === team.id);
        return (
          <Card key={team.id} sx={{ ...cardSx, flex: '1 1 180px', minWidth: 180 }}>
            <CardHeader
              title={
                <Typography variant="body1" sx={{ color: textPrimary, fontWeight: 600, fontSize: 14 }}>
                  {team.name}
                </Typography>
              }
              sx={{ pb: 0 }}
            />
            <CardContent sx={{ pt: 1, pb: '8px !important' }}>
              {members.length === 0 ? (
                <Typography variant="body2" sx={{ color: mutedText, fontStyle: 'italic' }}>No players</Typography>
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
                          sx={{ color: isCaptain ? textPrimary : textSecondary, fontWeight: isCaptain ? 600 : 400 }}
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
    <Typography variant="body2" sx={{ color: mutedText }}>Board not set up yet.</Typography>
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
                color: textPrimary,
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
    conflicts,
    pendingScreenshots,
    loading,
    error,
    isActive,
    isPlanned,
    startingNow,
    startError,
    startNow,
    endDialogOpen,
    setEndDialogOpen,
    endConfirmName,
    setEndConfirmName,
    endNameMatches,
    ending,
    endError,
    endBingo,
  } = useBingoOverview();

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
        <Typography sx={{ color: textSecondary }}>
          No bingo has been set up yet. Head to Bingo Details to get started.
        </Typography>
      </PageLayout>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────
  const boardLabel = bingo.boardSize === 16 ? '4×4' : bingo.boardSize === 35 ? '5×5' : `${bingo.boardSize} tiles`;
  const totalPoints = playerStats.reduce((sum, p) => sum + p.totalPoints, 0);
  const tilesCompleted = playerStats.reduce((sum, p) => sum + p.tilesCompleted, 0);
  const suspiciousPlayers = playerStats.filter(p => p.minutesOnline >= SUSPICIOUS_MINUTES);

  // ── Planned (pre-start) view ─────────────────────────────────────────────
  if (isPlanned) {
    return (
      <PageLayout title="Bingo Overview" maxWidth={700}>
        <Card sx={{ ...cardSx, width: '100%' }}>
          <CardHeader
            title={
              <Typography variant="h3" sx={{ fontSize: 22, color: textPrimary }}>
                {bingo.name}
              </Typography>
            }
            subheader={
              <Chip label="Upcoming" size="small" sx={{ bgcolor: 'rgba(42,157,143,0.2)', color: '#2A9D8F', mt: 0.5 }} />
            }
          />
          <CardContent>
            <Stack spacing={1.5} divider={<Divider sx={{ borderColor: subtleBorder }} />}>
              <InfoRow icon={<CalendarTodayIcon fontSize="small" />} label="Starts" value={fmt(bingo.startDate)} />
              <InfoRow icon={<CalendarTodayIcon fontSize="small" />} label="Ends" value={fmt(bingo.endDate)} />
              <InfoRow icon={<EmojiEventsIcon fontSize="small" />} label="Board" value={boardLabel} />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ ...cardSx, width: '100%' }}>
          <CardHeader
            avatar={<GroupsIcon sx={{ color: '#2A9D8F' }} />}
            title={<Typography variant="h3" sx={{ fontSize: 18, color: textPrimary }}>Teams</Typography>}
          />
          <CardContent sx={{ pt: 0 }}>
            <TeamRoster teams={teams} players={players} />
          </CardContent>
        </Card>

        <Card sx={{ ...cardSx, width: '100%' }}>
          <CardHeader
            avatar={<EmojiEventsIcon sx={{ color: '#2A9D8F' }} />}
            title={<Typography variant="h3" sx={{ fontSize: 18, color: textPrimary }}>Planned Board</Typography>}
            subheader={<Typography variant="body2" sx={{ color: mutedText }}>{boardLabel} — hover a tile for details</Typography>}
          />
          <CardContent sx={{ pt: 0 }}>
            <CompactBoard tiles={board} boardSize={bingo.boardSize} />
          </CardContent>
        </Card>

        <Countdown targetDate={new Date(bingo.startDate)} label="Time until the bingo begins" />

        {startError && <Alert severity="error" sx={{ width: '100%' }}>{startError}</Alert>}

        <Button
          variant="outlined"
          color="success"
          disabled={startingNow}
          startIcon={startingNow ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined}
          onClick={startNow}
          sx={{ alignSelf: 'center', ...outlinedButtonSx }}
        >
          {startingNow ? 'Starting…' : 'Start Bingo Now'}
        </Button>
      </PageLayout>
    );
  }

  // ── Active bingo dashboard ───────────────────────────────────────────────
  return (
    <PageLayout title="Bingo Overview" maxWidth="full">

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

      {/* ── Conflict alert ── */}
      {conflicts.length > 0 && (
        <Alert severity="error" icon={<LinkOffIcon />} sx={{ width: '100%' }}>
          {conflicts.length} side-account conflict{conflicts.length > 1 ? 's' : ''} detected — see table below
        </Alert>
      )}

      {/* ── Summary stat cards ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}>
        <StatCard label="Bingo" value={bingo.name} />
        <StatCard label="Ends" value={fmt(bingo.endDate)} />
        <StatCard label="Tiles Completed" value={tilesCompleted} />
        <StatCard label="Total Points Scored" value={totalPoints} />
        <StatCard label="Players" value={playerStats.length} />
        <StatCard
          label="Suspicious Activity"
          value={suspiciousPlayers.length}
          sub={suspiciousPlayers.length > 0 ? `${suspiciousPlayers.length} player${suspiciousPlayers.length > 1 ? 's' : ''} flagged` : 'None detected'}
        />
      </Box>

      {/* ── Player stats table ── */}
      <Card sx={{ ...cardSx, width: '100%' }}>
        <CardHeader
          title={<Typography variant="h3" sx={{ fontSize: 18, color: textPrimary }}>Player Stats</Typography>}
        />
        <CardContent sx={{ p: 0 }}>
          {playerStats.length === 0 ? (
            <Typography sx={{ color: mutedText, p: 2 }}>No player data yet.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Player', 'Team', 'Tiles', 'Points', 'Time Online', 'Last Seen', 'Side Accounts'].map(h => (
                      <TableCell key={h} sx={{ ...tableCellSx, color: mutedText, fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {playerStats.map(p => {
                    const suspicious = p.minutesOnline >= SUSPICIOUS_MINUTES;
                    return (
                      <TableRow
                        key={p.rsn}
                        sx={{ bgcolor: suspicious ? 'rgba(211,47,47,0.08)' : 'transparent' }}
                      >
                        <TableCell sx={tableCellSx}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body2" sx={{ color: textPrimary }}>{p.rsn}</Typography>
                            {suspicious && (
                              <Tooltip title={`${minutesToHours(p.minutesOnline)} online — possible bot/AHK`}>
                                <WarningAmberIcon fontSize="small" sx={{ color: '#f44336' }} />
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <Typography variant="body2" sx={{ color: textSecondary }}>{p.teamName}</Typography>
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <Typography variant="body2" sx={{ color: textPrimary }}>{p.tilesCompleted}</Typography>
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <Typography variant="body2" sx={{ color: textPrimary }}>{p.totalPoints}</Typography>
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <Typography
                            variant="body2"
                            sx={{ color: suspicious ? '#f44336' : textSecondary, fontWeight: suspicious ? 600 : 400 }}
                          >
                            {minutesToHours(p.minutesOnline)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <Typography variant="body2" sx={{ color: mutedText }}>{fmt(p.lastSeen)}</Typography>
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          {p.sideAccounts.length > 0 ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              {p.sideAccounts.map(acc => (
                                <Chip key={acc} label={acc} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: textSecondary }} />
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" sx={{ color: mutedText }}>—</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Side-account conflicts table ── */}
      {conflicts.length > 0 && (
        <Card sx={{ ...cardSx, width: '100%', border: '1px solid rgba(244,67,54,0.4)' }}>
          <CardHeader
            avatar={<LinkOffIcon sx={{ color: '#f44336' }} />}
            title={<Typography variant="h3" sx={{ fontSize: 18, color: '#f44336' }}>Side Account Conflicts</Typography>}
            subheader={<Typography variant="body2" sx={{ color: mutedText }}>Both accounts detected online simultaneously</Typography>}
          />
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Main Account', 'Side Account', 'Overlap', 'Detected At'].map(h => (
                      <TableCell key={h} sx={{ ...tableCellSx, color: mutedText, fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conflicts.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell sx={tableCellSx}><Typography variant="body2" sx={{ color: textPrimary }}>{c.mainRsn}</Typography></TableCell>
                      <TableCell sx={tableCellSx}><Typography variant="body2" sx={{ color: textPrimary }}>{c.sideRsn}</Typography></TableCell>
                      <TableCell sx={tableCellSx}>
                        <Chip
                          label={`${c.overlapMinutes}m overlap`}
                          size="small"
                          sx={{ bgcolor: 'rgba(244,67,54,0.15)', color: '#f44336' }}
                        />
                      </TableCell>
                      <TableCell sx={tableCellSx}><Typography variant="body2" sx={{ color: mutedText }}>{fmt(c.detectedAt)}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Time remaining ── */}
      <Card sx={{ ...cardSx, width: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <AccessTimeIcon sx={{ color: '#2A9D8F' }} />
            <Typography variant="h3" sx={{ fontSize: 18, color: textPrimary }}>Time Remaining</Typography>
          </Stack>
          <Countdown targetDate={new Date(bingo.endDate)} label="" />
        </CardContent>
      </Card>

      {/* ── End bingo button ── */}
      <Button
        variant="outlined"
        color="error"
        onClick={() => setEndDialogOpen(true)}
        sx={{ alignSelf: 'flex-end' }}
      >
        End Bingo Early
      </Button>

      {/* ── End bingo confirmation dialog ── */}
      <Dialog open={endDialogOpen} onClose={() => { setEndDialogOpen(false); setEndConfirmName(''); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: '#f44336' }}>End Bingo Early?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: textSecondary }}>
              This will immediately end <strong style={{ color: textPrimary }}>{bingo.name}</strong> and set the end time to now.
              This cannot be undone.
            </Typography>
            <Typography variant="body2" sx={{ color: textSecondary }}>
              Type <strong style={{ color: textPrimary }}>{bingo.name}</strong> to confirm.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              placeholder={bingo.name}
              value={endConfirmName}
              onChange={e => setEndConfirmName(e.target.value)}
              error={endConfirmName.length > 0 && !endNameMatches}
              helperText={endConfirmName.length > 0 && !endNameMatches ? 'Name does not match' : ' '}
            />
            {endError && <Alert severity="error">{endError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEndDialogOpen(false); setEndConfirmName(''); }} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
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
