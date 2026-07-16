import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { BingoPlayer, BingoTeam } from '../TeamDrafter/useTeamDrafter';
import {
  selectSx,
  subtleBorder,
  textPrimary,
  textSecondary,
} from '../TeamDrafter/teamDrafterStyles';
import { appColors } from '../../../../layout/Theme';
import { BoardTile, PendingScreenshotSubmission } from './useScreenshotSubmission';

// `timeZoneName: 'short'` appends an explicit zone abbreviation (e.g. "EST",
// "GMT+1") — the admin team spans multiple timezones, so a bare local time
// is ambiguous (Story: screenshot review follow-ups). `Intl.DateTimeFormat`
// rejects `timeZoneName` combined with `dateStyle`/`timeStyle`, so this
// spells out the equivalent individual components instead.
const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

const tileLabel = (tile: BoardTile) => `${tile.task} — ${tile.type}, ${tile.points}pts`;

/** Visible disabled styling for outlined buttons against the dark card —
 * default MUI disabled opacity is unreadable here (Story 3c). */
const disabledOutlinedSx = {
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,0.38)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
};

export type ScreenshotCardProps = {
  submission: PendingScreenshotSubmission;
  tileOptions: (BoardTile & { id: string })[];
  teams: BingoTeam[];
  players: BingoPlayer[];
  boardMissingTileIds: boolean;
  tileId: string | undefined;
  teamId: string | undefined;
  playerId: string | undefined;
  onTileChange: (tileId: string) => void;
  onTeamChange: (teamId: string) => void;
  onPlayerChange: (playerId: string) => void;
  onApprove: () => void;
  onDeny: () => void;
  isApproving: boolean;
  isDenying: boolean;
  error?: string;
  onDismissError: () => void;
};

export function ScreenshotCard({
  submission,
  tileOptions,
  teams,
  players,
  boardMissingTileIds,
  tileId,
  teamId,
  playerId,
  onTileChange,
  onTeamChange,
  onPlayerChange,
  onApprove,
  onDeny,
  isApproving,
  isDenying,
  error,
  onDismissError,
}: ScreenshotCardProps) {
  const busy = isApproving || isDenying;
  const canApprove = !busy && !!tileId && !!teamId;

  // A signed image URL can expire (5-minute TTL) before the next poll/refresh
  // replaces it. Once the <img> fails to load, swap to the placeholder rather
  // than showing a broken image; a fresh submission.imageUrl resets this.
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [submission.imageUrl]);

  const teamPlayers = teamId ? players.filter((p) => p.team_id === teamId) : [];

  return (
    <Card sx={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column' }}>
      {submission.imageUrl && !imgFailed ? (
        <Box
          component="a"
          href={submission.imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open full-size screenshot submitted by ${submission.submittedBy}`}
          sx={{
            position: 'relative',
            display: 'block',
            '&:hover .zoomHint': { opacity: 1 },
            // Keyboard users tabbing to the link get the same zoom affordance
            // hover-only users see, plus a visible focus ring (Story: screenshot
            // review follow-ups — zoom hint didn't appear on keyboard focus).
            '&:focus-visible .zoomHint': { opacity: 1 },
            '&:focus-visible': { outline: `2px solid ${appColors.accent}`, outlineOffset: 2 },
          }}
        >
          <CardMedia
            component="img"
            image={submission.imageUrl}
            alt={`Screenshot submitted by ${submission.submittedBy}`}
            loading="lazy"
            onError={() => setImgFailed(true)}
            sx={{ height: 200, objectFit: 'cover', bgcolor: 'rgba(255,255,255,0.04)' }}
          />
          <Box
            className="zoomHint"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'rgba(0,0,0,0.6)',
              borderRadius: 1,
              p: 0.5,
              opacity: 0.7,
              transition: 'opacity 0.15s',
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 16, color: textPrimary }} />
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.04)',
          }}
        >
          <Typography variant="caption" sx={{ color: textSecondary }}>
            Image unavailable
          </Typography>
        </Box>
      )}

      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1 }}>
        <Stack spacing={0.25}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: textPrimary }}>
            {submission.submittedBy}
          </Typography>
          <Typography variant="caption" sx={{ color: textSecondary }}>
            Submitted {fmt(submission.submittedAt)}
          </Typography>
        </Stack>

        <FormControl size="small" fullWidth disabled={busy || tileOptions.length === 0}>
          <InputLabel id={`tile-label-${submission.id}`} sx={{ color: textSecondary }}>
            Tile
          </InputLabel>
          <Select
            labelId={`tile-label-${submission.id}`}
            label="Tile"
            value={tileId ?? ''}
            onChange={(e) => onTileChange(e.target.value)}
            sx={{ ...selectSx, width: '100%' }}
          >
            {tileOptions.map((tile) => (
              <MenuItem key={tile.id} value={tile.id}>
                {tileLabel(tile)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {boardMissingTileIds && (
          <Typography variant="caption" sx={{ color: 'error.main' }}>
            No tile options available — the board endpoint isn&apos;t returning tile ids yet.
          </Typography>
        )}

        <FormControl size="small" fullWidth disabled={busy || teams.length === 0}>
          <InputLabel id={`team-label-${submission.id}`} sx={{ color: textSecondary }}>
            Team
          </InputLabel>
          <Select
            labelId={`team-label-${submission.id}`}
            label="Team"
            value={teamId ?? ''}
            onChange={(e) => onTeamChange(e.target.value)}
            sx={{ ...selectSx, width: '100%' }}
          >
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth disabled={busy || !teamId || teamPlayers.length === 0}>
          <InputLabel id={`player-label-${submission.id}`} sx={{ color: textSecondary }}>
            Player (optional)
          </InputLabel>
          <Select
            labelId={`player-label-${submission.id}`}
            label="Player (optional)"
            value={playerId ?? ''}
            onChange={(e) => onPlayerChange(e.target.value)}
            sx={{ ...selectSx, width: '100%' }}
          >
            <MenuItem value="">
              <em>Unassigned</em>
            </MenuItem>
            {teamPlayers.map((player) => (
              <MenuItem key={player.id} value={player.id}>
                {player.rsn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {!teamId ? (
          <Typography variant="caption" sx={{ color: textSecondary }}>
            Choose a team to attribute this submission to a player.
          </Typography>
        ) : teamPlayers.length === 0 ? (
          <Typography variant="caption" sx={{ color: textSecondary }}>
            No players registered on this team yet.
          </Typography>
        ) : !playerId ? (
          // Non-blocking nudge (bug-report investigation, H1): approving with
          // no player picked still counts for the team, but the tile won't
          // show up anywhere per-player until an admin backfills it via the
          // "Needs Player Attribution" section below. Left optional
          // deliberately — some submissions genuinely can't be attributed
          // (e.g. a group screenshot) — this just makes the tradeoff visible
          // instead of a silent default.
          <Typography variant="caption" sx={{ color: 'warning.main' }}>
            No player selected — this won&apos;t show up in per-player stats (team totals still
            count it).
          </Typography>
        ) : null}

        {error && (
          <Alert severity="error" onClose={onDismissError}>
            {error}
          </Alert>
        )}

        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 'auto', pt: 1, borderTop: `1px solid ${subtleBorder}` }}
        >
          <Button
            variant="outlined"
            color="success"
            fullWidth
            disabled={!canApprove}
            onClick={onApprove}
            sx={disabledOutlinedSx}
            startIcon={
              isApproving ? (
                <CircularProgress size={16} sx={{ color: 'inherit' }} />
              ) : (
                <CheckCircleOutlineIcon />
              )
            }
          >
            Approve
          </Button>
          <Button
            variant="outlined"
            color="error"
            fullWidth
            disabled={busy}
            onClick={onDeny}
            sx={disabledOutlinedSx}
            startIcon={
              isDenying ? (
                <CircularProgress size={16} sx={{ color: 'inherit' }} />
              ) : (
                <HighlightOffIcon />
              )
            }
          >
            Deny
          </Button>
        </Stack>
        {!busy && (!tileId || !teamId) && (
          <Typography variant="caption" sx={{ color: textSecondary, mt: -1 }}>
            Pick a tile and team to approve.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
