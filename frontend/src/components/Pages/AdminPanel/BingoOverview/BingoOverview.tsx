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
import PeopleIcon from '@mui/icons-material/People';
import GridViewIcon from '@mui/icons-material/GridView';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PageLayout from '../../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../../layout/Theme';
import { Countdown } from '../../../Countdown/Countdown';
import { useBingoOverview } from './useBingoOverview';
import { BingoTeam, BingoPlayer } from '../TeamDrafter/useTeamDrafter';
import { Tile } from '../BoardBuilder/useBoardBuilder';
import { StatTile } from './StatTile';
import { TeamPointsChart } from './TeamPointsChart';
import { BoardProgressGauge } from './BoardProgressGauge';
import { PlayerStatsTable } from './PlayerStatsTable';
import { DependencyHealthSection } from './DependencyHealthSection';
import { ConflictsSection } from './ConflictsSection';

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

// ─── Section wrapper ───────────────────────────────────────────────────────
const Section = ({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card sx={{ width: '100%' }}>
    <CardHeader
      avatar={<Box sx={{ color: appColors.accent, display: 'flex' }}>{icon}</Box>}
      title={
        <Typography variant="h3" sx={{ fontSize: 18 }}>
          {title}
        </Typography>
      }
      action={action}
    />
    <CardContent sx={{ pt: 0 }}>{children}</CardContent>
  </Card>
);

// ─── Info Row (Planned view) ────────────────────────────────────────────────
const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
    <Box sx={{ color: appColors.accent, display: 'flex' }}>{icon}</Box>
    <Typography variant="body2" sx={{ minWidth: 110 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>
      {value}
    </Typography>
  </Stack>
);

// ─── Team Roster (Planned view) ─────────────────────────────────────────────
const TeamRoster = ({ teams, players }: { teams: BingoTeam[]; players: BingoPlayer[] }) => {
  if (teams.length === 0) return <Typography variant="body2">No teams assigned yet.</Typography>;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}>
      {teams.map((team) => {
        const members = players.filter(
          (p) => p.team_id === team.id || p.captain_team_id === team.id,
        );
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
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  No players
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {members.map((p) => {
                    const isCaptain = p.captain_team_id === team.id;
                    return (
                      <Stack key={p.rsn} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        {isCaptain && (
                          <Tooltip title="Captain">
                            <StarIcon sx={{ fontSize: 13, color: '#FFD700' }} />
                          </Tooltip>
                        )}
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: isCaptain ? 600 : 400 }}
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

// ─── Compact Board (Planned view) ───────────────────────────────────────────
const tileObjective = (tile: Tile): string => {
  if (tile.type === 'Kill Count') return `Kill ${tile.killCount}×`;
  if (tile.type === 'Experience') return `${tile.experience.toLocaleString()} xp`;
  return `${tile.dropsAmount} drop${tile.dropsAmount !== 1 ? 's' : ''}`;
};

const CompactBoard = ({ tiles, boardSize }: { tiles: Tile[]; boardSize: number }) => {
  const cols = boardSize === 35 ? 5 : 4;
  if (tiles.length === 0) return <Typography variant="body2">Board not set up yet.</Typography>;
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
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {tile.task}
              </Typography>
              <Typography variant="caption">{tile.type}</Typography>
              <Typography variant="caption">Obj: {tileObjective(tile)}</Typography>
              <Typography variant="caption">{tile.points} pts</Typography>
            </Stack>
          }
          arrow
        >
          <Box
            sx={{
              background: `linear-gradient(135deg, ${appColors.accent} 0%, rgba(13,13,13,0.86) 100%)`,
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
    teamStats,
    unresolvableTiles,
    pendingScreenshots,
    health,
    healthError,
    conflicts,
    conflictsError,
    loading,
    error,
    permissionDenied,
    isComplete,
    isPlanned,
    latestPendingCount,
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
        <CircularProgress sx={{ color: appColors.accent }} />
      </PageLayout>
    );
  }

  // Permission-denied takes precedence over both the error and empty states
  // below — the caller can't see the answer either way, so don't let the
  // page render as if there's definitely no bingo (same pattern as
  // BingoDetails/BoardBuilder — bug-report investigation, prod incident).
  if (permissionDenied) {
    return (
      <PageLayout title="Bingo Overview" align="center" permissionDenied />
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
        <Typography>No bingo has been set up yet. Head to Bingo Details to get started.</Typography>
      </PageLayout>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────
  const boardLabel =
    bingo.boardSize === 16 ? '4×4' : bingo.boardSize === 35 ? '5×5' : `${bingo.boardSize} tiles`;
  // Prefer team-level ground truth (team-stats, computed straight from
  // team_id — never depends on the optional per-submission player
  // attribution) for the headline KPIs; falls back to summing playerStats
  // if team-stats hasn't loaded. Player-level totals alone under-report
  // whenever an admin approved a screenshot without picking a player (see
  // TeamStat's doc comment in useBingoOverview.ts) — using the team total
  // here means these top-line numbers always reflect real completions.
  const totalPoints = teamStats.length
    ? teamStats.reduce((sum, t) => sum + t.totalPoints, 0)
    : playerStats.reduce((sum, p) => sum + p.totalPoints, 0);
  const tilesCompleted = teamStats.length
    ? teamStats.reduce((sum, t) => sum + t.tilesCompleted, 0)
    : playerStats.reduce((sum, p) => sum + p.tilesCompleted, 0);
  const pointsPossible = board.reduce((sum, t) => sum + t.points, 0);
  const staleCount = playerStats.filter((p) => p.rsnStale).length;
  const unattributedTiles = teamStats.reduce((sum, t) => sum + t.unattributedTiles, 0);

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
                  bgcolor:
                    bingo.status === 'planned'
                      ? 'rgba(255, 214, 0, 0.15)'
                      : 'rgba(255, 140, 0, 0.15)',
                  color: bingo.status === 'planned' ? '#FFD600' : '#FF8C00',
                  textTransform: 'capitalize',
                }}
              />
            }
            slotProps={{ subheader: { sx: { py: 1.5 } } }}
          />

          <CardContent>
            <Stack spacing={1.5} divider={<Divider />}>
              <InfoRow
                icon={<CalendarTodayIcon fontSize="small" />}
                label="Starts"
                value={fmt(bingo.startDate)}
              />
              <InfoRow
                icon={<CalendarTodayIcon fontSize="small" />}
                label="Ends"
                value={fmt(bingo.endDate)}
              />
              <InfoRow
                icon={<EmojiEventsIcon fontSize="small" />}
                label="Board"
                value={boardLabel}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ width: '100%' }}>
          <CardHeader
            avatar={<GroupsIcon sx={{ color: appColors.accent }} />}
            title={
              <Typography variant="h3" sx={{ fontSize: 18 }}>
                Teams
              </Typography>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            <TeamRoster teams={teams} players={players} />
          </CardContent>
        </Card>

        <Card sx={{ width: '100%' }}>
          <CardHeader
            avatar={<EmojiEventsIcon sx={{ color: appColors.accent }} />}
            title={
              <Typography variant="h3" sx={{ fontSize: 18 }}>
                Planned Board
              </Typography>
            }
            subheader={<Typography variant="body2">{boardLabel}</Typography>}
          />
          <CardContent sx={{ pt: 0 }}>
            <CompactBoard tiles={board} boardSize={bingo.boardSize} />
          </CardContent>
        </Card>

        {startError && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {startError}
          </Alert>
        )}

        <Button
          variant="outlined"
          color="success"
          disabled={startingNow}
          startIcon={
            startingNow ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined
          }
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
      {/* ── Bingo-ended-with-pending-screenshots banner (TEAM-BRIEF.md Sprint
          15, decision 4a): the lifecycle check completes a bingo without
          waiting on its pending submissions (decision 2) — this is the
          in-app half of the resulting notification, sourced from GET
          /bingo/latest's own `pendingScreenshots` count (not the
          /screenshots/pending list below, which is a separate fetch), and
          persists until that count hits 0. Icon + bold copy give it a
          non-color cue distinct from the info/warning alerts below, since
          this is the most actionable state a completed bingo can be in. ── */}
      {isComplete && latestPendingCount > 0 && (
        <Alert
          severity="warning"
          variant="filled"
          icon={<WarningAmberIcon />}
          action={
            <Button size="small" color="inherit" href="/AdminPanel/ScreenshotSubmission">
              Review
            </Button>
          }
          sx={{ width: '100%' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Bingo ended with {latestPendingCount} screenshot{latestPendingCount > 1 ? 's' : ''} awaiting
            review
          </Typography>
        </Alert>
      )}
      {/* ── Pending screenshots alert — Drops-specific copy (TEAM-BRIEF.md
          Sprint 13, Track B item 3): the only screenshots left in this flow
          are Drops-tile submissions, KC/XP tiles auto-verify from the
          hiscores and never reach this queue. ── */}
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
          {pendingScreenshots.length} drop screenshot{pendingScreenshots.length > 1 ? 's' : ''}{' '}
          pending review
        </Alert>
      )}
      {/* ── RSN-stale alert ── */}
      {staleCount > 0 && (
        <Alert severity="warning" icon={<GppMaybeIcon />} sx={{ width: '100%' }}>
          {staleCount} player{staleCount > 1 ? 's have' : ' has'} an RSN that may have changed —
          see the flagged rows in Player Stats below.
        </Alert>
      )}
      {/* ── Player stats load failure (distinct from the fatal page error above) ── */}
      {playerStatsError && (
        <Alert severity="warning" sx={{ width: '100%' }}>
          {playerStatsError}
        </Alert>
      )}
      {/* ── Attribution gap: Drops tiles a team completed with no player
          picked at approval time. Points/tiles KPI totals above already
          account for these (team-level ground truth); the Player Stats
          table below cannot — it can only ever show what's attributed to
          someone. Drops-specific copy (TEAM-BRIEF.md Sprint 13, Track B
          item 3 / Track A item 3): KC/XP tiles auto-verify at the team
          level and are never individually attributed — attribution only
          ever concerns Drops-tile submissions now, so this banner (and the
          count backing it) is scoped to those. Names the destination page
          correctly (it's "Screenshot Submissions" in the sidebar/page
          title, not "Screenshot Review" — a prior version of this banner
          used the wrong name) and links straight to its "Needs Player
          Attribution" worklist, matching the pending-screenshots alert's
          own Review button above, so an admin who lands here isn't left to
          guess where "here" is. ── */}
      {unattributedTiles > 0 && (
        <Alert
          severity="info"
          icon={<GppMaybeIcon />}
          action={
            <Button size="small" color="inherit" href="/AdminPanel/ScreenshotSubmission">
              Attribute
            </Button>
          }
          sx={{ width: '100%' }}
        >
          {unattributedTiles} Drops tile completion{unattributedTiles > 1 ? 's are' : ' is'} not
          linked to a specific player (approved without picking one) — counted in the totals
          above, but won&apos;t appear in the Player Stats table below until fixed on the
          Screenshot Submissions page&apos;s &quot;Needs Player Attribution&quot; list.
        </Alert>
      )}
      {/* ── Unresolvable tiles: trackable-type (Kill Count/Experience) tiles
          whose task text couldn't be mapped to a hiscore metric by the
          completion engine (TEAM-BRIEF.md Sprint 13, Track A item 1 /
          Track B item 3) — they will NEVER auto-complete as written. Points
          to Board Builder, since the fix is almost always retyping the task
          to exactly match the hiscores autocomplete vocabulary. ── */}
      {unresolvableTiles.length > 0 && (
        <Alert
          severity="error"
          icon={<ReportProblemIcon />}
          action={
            <Button size="small" color="inherit" href="/AdminPanel/BoardBuilder">
              Fix in Board Builder
            </Button>
          }
          sx={{ width: '100%' }}
        >
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {unresolvableTiles.length} tile{unresolvableTiles.length > 1 ? 's' : ''} can&apos;t
              auto-verify — task text doesn&apos;t match a hiscores metric.
            </Typography>
            <Typography variant="body2" component="span">
              {unresolvableTiles.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && ', '}
                  &quot;{t.task}&quot; ({t.type})
                </span>
              ))}
            </Typography>
          </Stack>
        </Alert>
      )}

      {/* ── Summary stat tiles (KPI row) ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, width: '100%' }}>
        <StatTile icon={<EmojiEventsIcon />} label="Bingo" value={bingo.name} sub={fmt(bingo.endDate)} />
        <StatTile icon={<ScoreboardIcon />} label="Total Points Scored" value={totalPoints.toLocaleString()} />
        <StatTile icon={<GridViewIcon />} label="Tiles Completed" value={tilesCompleted} />
        <StatTile icon={<PeopleIcon />} label="Players" value={players.length} />
      </Box>

      {/* ── Team standings: points chart + board progress meter ── */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          width: '100%',
          '& > *': { flex: '1 1 380px', minWidth: 300 },
        }}
      >
        <Section icon={<EmojiEventsIcon />} title="Points by Team">
          <TeamPointsChart playerStats={playerStats} teamStats={teamStats} />
        </Section>
        <Section icon={<GridViewIcon />} title="Board Progress">
          <BoardProgressGauge pointsScored={totalPoints} pointsPossible={pointsPossible} />
        </Section>
      </Box>

      {/* ── Dependency health ── */}
      <Section icon={<MonitorHeartIcon />} title="Dependency Health">
        <DependencyHealthSection health={health} healthError={healthError} />
      </Section>

      {/* ── Side-account conflicts ── */}
      <Section icon={<GppMaybeIcon />} title="Side-Account Conflicts">
        <ConflictsSection conflicts={conflicts} conflictsError={conflictsError} />
      </Section>

      {/* ── Player stats table ── */}
      <Section icon={<PeopleIcon />} title="Player Stats">
        <PlayerStatsTable playerStats={playerStats} />
      </Section>

      {/* ── Time remaining (active) / ended notice (complete) — a completed
          bingo has nothing left to count down to, and "End Bingo Early" no
          longer applies (TEAM-BRIEF.md Sprint 15 Track B item 1: "fully
          functional for a complete bingo", not still showing active-only
          affordances). ── */}
      {isComplete ? (
        <Card sx={{ width: '100%' }}>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <AccessTimeIcon sx={{ color: appColors.accent }} />
              <Typography variant="body1">This bingo ended {fmt(bingo.endDate)}.</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ width: '100%' }}>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
              <AccessTimeIcon sx={{ color: appColors.accent }} />
              <Typography variant="h3" sx={{ fontSize: 18 }}>
                Time Remaining
              </Typography>
            </Stack>
            <Countdown targetDate={endDateObj} label="" />
          </CardContent>
        </Card>
      )}

      {/* ── Refresh stats / end bingo controls ── */}
      <Stack direction="row" spacing={2} sx={{ alignSelf: 'flex-end' }}>
        <Button
          variant="outlined"
          disabled={refreshingStats}
          startIcon={
            refreshingStats ? (
              <CircularProgress size={16} sx={{ color: 'inherit' }} />
            ) : (
              <SyncIcon />
            )
          }
          onClick={refreshAllStats}
          sx={{
            color: appColors.accent,
            borderColor: appColors.accent,
            '&:hover': { borderColor: appColors.accent, bgcolor: 'rgba(42,157,143,0.08)' },
          }}
        >
          {refreshingStats ? 'Refreshing…' : 'Refresh Player Stats'}
        </Button>
        {!isComplete && (
          <Button variant="outlined" color="error" onClick={() => setEndDialogOpen(true)}>
            End Bingo Early
          </Button>
        )}
      </Stack>

      {/* ── End bingo confirmation dialog ── */}
      <Dialog
        open={endDialogOpen}
        onClose={() => {
          setEndDialogOpen(false);
          setEndConfirmName('');
        }}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: '#1a1a1a',
              backgroundImage: 'none',
              border: `1px solid ${appColors.subtleBorder}`,
            },
          },
        }}
      >
        <DialogTitle sx={{ color: '#f44336', fontFamily: "'pacifico', cursive" }}>
          End Bingo Early?
        </DialogTitle>
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
              onChange={(e) => setEndConfirmName(e.target.value)}
              error={endConfirmName.length > 0 && !endNameMatches}
              helperText={
                endConfirmName.length > 0 && !endNameMatches ? 'Name does not match' : ' '
              }
              sx={{
                '& .MuiFormHelperText-root': { color: '#f44336' },
              }}
            />
            {endError && <Alert severity="error">{endError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setEndDialogOpen(false);
              setEndConfirmName('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={!endNameMatches || ending}
            startIcon={
              ending ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined
            }
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
