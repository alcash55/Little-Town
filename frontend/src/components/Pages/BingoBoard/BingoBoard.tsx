import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../layout/Theme';
import { useBingoBoard } from './useBingoBoard';
import { BingoBoardHeader } from './BingoBoardHeader';
import { BingoTile } from './BingoTile';
import { BingoBoardSkeleton } from './BingoBoardSkeleton';

const BingoBoard = () => {
  const { board, loading, error, refetch } = useBingoBoard();

  if (loading) {
    return (
      <PageLayout title="Bingo Board" maxWidth="full">
        <BingoBoardSkeleton />
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
  //
  // Mobile strategy: the board stays a full, non-scrolling grid at every
  // breakpoint (never horizontal-scroll or a stacked list) — seeing every
  // square at once is core to reading a bingo board. Real boards top out at
  // 5x5 (see BingoDetails' size picker), so even at 390px wide, tiles scale
  // down to ~60px squares rather than slivers; padding/gap/font shrink at
  // `xs` and long task text is always one tap/click away in full via the
  // tile's detail dialog.
  const columns = Math.max(1, Math.round(Math.sqrt(tiles.length || bingo.boardSize || 1)));
  const completedCount = tiles.filter((tile) => tile.completedByMyTeam).length;

  return (
    <PageLayout title="Bingo Board" maxWidth="full">
      <BingoBoardHeader
        bingo={bingo}
        myTeam={myTeam}
        completedCount={completedCount}
        totalCount={tiles.length}
      />

      <Box
        role="group"
        aria-label={`${bingo.name} board, ${tiles.length} tiles`}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: { xs: 1, sm: 1.5 },
          width: '100%',
          maxWidth: 900,
        }}
      >
        {tiles.map((tile) => (
          <BingoTile
            key={tile.id}
            task={tile.task}
            completed={tile.completedByMyTeam}
            myTeamName={myTeam?.name}
          />
        ))}
      </Box>
    </PageLayout>
  );
};

export default BingoBoard;
