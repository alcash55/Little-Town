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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { BingoTeam } from '../TeamDrafter/useTeamDrafter';
import { selectSx, subtleBorder, textPrimary, textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { BoardTile, PendingScreenshotSubmission } from './useScreenshotSubmission';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const tileLabel = (tile: BoardTile) => `${tile.task} — ${tile.type}, ${tile.points}pts`;

export type ScreenshotCardProps = {
  submission: PendingScreenshotSubmission;
  tileOptions: (BoardTile & { id: string })[];
  teams: BingoTeam[];
  boardMissingTileIds: boolean;
  tileId: string | undefined;
  teamId: string | undefined;
  onTileChange: (tileId: string) => void;
  onTeamChange: (teamId: string) => void;
  onApprove: () => void;
  onDeny: () => void;
  isApproving: boolean;
  isDenying: boolean;
  error?: string;
};

export function ScreenshotCard({
  submission,
  tileOptions,
  teams,
  boardMissingTileIds,
  tileId,
  teamId,
  onTileChange,
  onTeamChange,
  onApprove,
  onDeny,
  isApproving,
  isDenying,
  error,
}: ScreenshotCardProps) {
  const busy = isApproving || isDenying;
  const canApprove = !busy && !!tileId && !!teamId;

  return (
    <Card sx={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column' }}>
      {submission.imageUrl ? (
      <Box
        component="a"
        href={submission.imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open full-size screenshot submitted by ${submission.submittedBy}`}
        sx={{ position: 'relative', display: 'block', '&:hover .zoomHint': { opacity: 1 } }}
      >
        <CardMedia
          component="img"
          image={submission.imageUrl}
          alt={`Screenshot submitted by ${submission.submittedBy}`}
          loading="lazy"
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
          <Typography variant="caption" sx={{ color: '#f44336' }}>
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

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" spacing={1} sx={{ mt: 'auto', pt: 1, borderTop: `1px solid ${subtleBorder}` }}>
          <Button
            variant="outlined"
            color="success"
            fullWidth
            disabled={!canApprove}
            onClick={onApprove}
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
            startIcon={
              isDenying ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <HighlightOffIcon />
            }
          >
            Deny
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
