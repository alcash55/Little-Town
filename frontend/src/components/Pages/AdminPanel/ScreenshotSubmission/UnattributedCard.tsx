import { Alert, Box, Button, Card, CardContent, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { BingoPlayer } from '../TeamDrafter/useTeamDrafter';
import { selectSx, subtleBorder, textPrimary, textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { appColors } from '../../../../layout/Theme';
import { UnattributedSubmission } from './useScreenshotSubmission';

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : '—';

export type UnattributedCardProps = {
  submission: UnattributedSubmission;
  players: BingoPlayer[];
  playerId: string | undefined;
  onPlayerChange: (playerId: string) => void;
  onAttribute: () => void;
  isAttributing: boolean;
  error?: string;
  onDismissError: () => void;
};

/**
 * Backfill row for the attribution gap (bug-report investigation, H1): an
 * approved submission that never got a player picked. Smaller than
 * ScreenshotCard (no tile/team pickers — those were already decided at
 * approval time and are read-only here), but the same visual language.
 */
export function UnattributedCard({
  submission,
  players,
  playerId,
  onPlayerChange,
  onAttribute,
  isAttributing,
  error,
  onDismissError,
}: UnattributedCardProps) {
  const teamPlayers = submission.teamId ? players.filter((p) => p.team_id === submission.teamId) : [];

  return (
    <Card sx={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1 }}>
        <Stack spacing={0.25}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: textPrimary }}>
            {submission.tileTask ?? 'Unknown tile'}
          </Typography>
          <Typography variant="caption" sx={{ color: textSecondary }}>
            {submission.teamName ?? 'Unassigned team'} · approved {fmt(submission.approvedAt)}
          </Typography>
          <Typography variant="caption" sx={{ color: textSecondary }}>
            Submitted by {submission.submittedBy}
          </Typography>
        </Stack>

        {submission.imageUrl && (
          <Box
            component="a"
            href={submission.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open full-size screenshot submitted by ${submission.submittedBy}`}
            sx={{ color: appColors.accent, fontSize: 13 }}
          >
            View screenshot
          </Box>
        )}

        <FormControl size="small" fullWidth disabled={isAttributing || teamPlayers.length === 0}>
          <InputLabel id={`attribute-player-label-${submission.id}`} sx={{ color: textSecondary }}>
            Player
          </InputLabel>
          <Select
            labelId={`attribute-player-label-${submission.id}`}
            label="Player"
            value={playerId ?? ''}
            onChange={(e) => onPlayerChange(e.target.value)}
            sx={{ ...selectSx, width: '100%' }}
          >
            {teamPlayers.map((player) => (
              <MenuItem key={player.id} value={player.id}>
                {player.rsn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {teamPlayers.length === 0 && (
          <Typography variant="caption" sx={{ color: textSecondary }}>
            No players registered on this team.
          </Typography>
        )}

        {error && (
          <Alert severity="error" onClose={onDismissError}>
            {error}
          </Alert>
        )}

        <Button
          variant="outlined"
          color="success"
          fullWidth
          disabled={isAttributing || !playerId}
          onClick={onAttribute}
          startIcon={
            isAttributing ? (
              <CircularProgress size={16} sx={{ color: 'inherit' }} />
            ) : (
              <PersonAddAlt1Icon />
            )
          }
          sx={{
            mt: 'auto',
            pt: 1,
            borderTop: `1px solid ${subtleBorder}`,
            '&.Mui-disabled': {
              color: 'rgba(255,255,255,0.38)',
              borderColor: 'rgba(255,255,255,0.18)',
            },
          }}
        >
          {isAttributing ? 'Saving…' : 'Attribute'}
        </Button>
      </CardContent>
    </Card>
  );
}
