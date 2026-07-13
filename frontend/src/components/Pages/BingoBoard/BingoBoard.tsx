import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { darken } from '@mui/material/styles';
import GridViewIcon from '@mui/icons-material/GridView';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../layout/Theme';
import { useBingoBoard } from './useBingoBoard';

// `theme.palette.success.dark` alone is only ~4.1:1 against white text —
// short of WCAG AA's 4.5:1 for this tile text's size. Darken the token
// itself (rather than hardcoding a new hex) to ~5.9:1, comfortably passing,
// while still tracking the theme's success color if it ever changes.
const completedTileBg = (theme: { palette: { success: { dark: string } } }) =>
  darken(theme.palette.success.dark, 0.2);

const BingoBoard = () => {
  const { board, loading, error, refetch } = useBingoBoard();

  if (loading) {
    return (
      <PageLayout title="Bingo Board" align="center">
        <CircularProgress sx={{ color: appColors.accent }} />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Bingo Board" align="center">
        <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          onClick={() => void refetch()}
          sx={{ mt: 2, color: appColors.accent, borderColor: appColors.accent }}
        >
          Retry
        </Button>
      </PageLayout>
    );
  }

  if (!board?.active) {
    return (
      <PageLayout title="Bingo Board" align="center">
        <Stack
          spacing={1.5}
          sx={{
            alignItems: 'center',
            textAlign: 'center',
            width: '100%',
            py: 4,
            color: appColors.textSecondary,
          }}
        >
          <GridViewIcon sx={{ fontSize: 48, color: appColors.mutedText }} />
          <Typography variant="h6">No active bingo</Typography>
          <Typography variant="body2" sx={{ color: appColors.textSecondary, maxWidth: 420 }}>
            There isn't a bingo running right now. Once an admin starts one, its board will show up
            here.
          </Typography>
        </Stack>
      </PageLayout>
    );
  }

  const { bingo, myTeam, tiles } = board;
  // Boards are built as perfect squares (see BoardBuilder), so this recovers
  // a clean column count from the total tile count; an odd `boardSize` just
  // wraps the last row short via the grid's normal auto-flow rather than
  // breaking layout.
  const columns = Math.max(1, Math.round(Math.sqrt(tiles.length || bingo.boardSize || 1)));

  return (
    <PageLayout title="Bingo Board" maxWidth="full">
      <Stack spacing={0.5} sx={{ alignItems: 'center', width: '100%' }}>
        <Typography variant="h3" sx={{ fontSize: 28, textAlign: 'center' }}>
          {bingo.name}
        </Typography>
        <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
          {myTeam ? `Your team: ${myTeam.name}` : "You're not on a team for this bingo yet."}
        </Typography>
      </Stack>

      {myTeam && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
          <Box
            sx={(theme) => ({
              width: 14,
              height: 14,
              borderRadius: 0.5,
              bgcolor: completedTileBg(theme),
              border: `1px solid ${appColors.cardBorder}`,
            })}
          />
          <Typography variant="body2" sx={{ color: appColors.textSecondary }}>
            Completed by {myTeam.name}
          </Typography>
        </Stack>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: { xs: 1, sm: 1.5 },
          width: '100%',
          maxWidth: 900,
          mt: 3,
        }}
      >
        {tiles.map((tile) => (
          <Box
            key={tile.id}
            role="gridcell"
            aria-label={
              tile.completedByMyTeam ? `${tile.task} — completed by your team` : tile.task
            }
            sx={(theme) => ({
              position: 'relative',
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              p: { xs: 0.75, sm: 1.5 },
              borderRadius: 1,
              border: `1px solid ${appColors.cardBorder}`,
              bgcolor: tile.completedByMyTeam ? completedTileBg(theme) : 'background.paper',
              color: tile.completedByMyTeam
                ? theme.palette.success.contrastText
                : appColors.textPrimary,
              boxSizing: 'border-box',
              overflow: 'hidden',
            })}
          >
            {tile.completedByMyTeam && (
              <CheckCircleIcon
                fontSize="small"
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  color: 'success.contrastText',
                  opacity: 0.85,
                }}
              />
            )}
            <Typography
              variant="body2"
              sx={{
                fontSize: { xs: 11, sm: 13 },
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {tile.task}
            </Typography>
          </Box>
        ))}
      </Box>
    </PageLayout>
  );
};

export default BingoBoard;
