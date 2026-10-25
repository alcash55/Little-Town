import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../layout/Theme';
import { useBingoBoard } from './useBingoBoard';
import { BingoBoardHeader } from './BingoBoardHeader';
import { BingoTile } from './BingoTile';
import { BingoBoardSkeleton } from './BingoBoardSkeleton';

const BingoBoard = () => {
  const { board, loading, error, refetch } = useBingoBoard();

  // Let the grid fill the page width. Height-based fitting made the board
  // shrink as the header grew, leaving most of the available width unused.
  const tiles = board?.active ? board.tiles : [];
  const columns = Math.max(
    1,
    Math.round(Math.sqrt(tiles.length || (board?.active ? board.bingo.boardSize : 0) || 1)),
  );
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
    // TEAM-BRIEF.md Sprint 15, Track A item 4 / Track B item 3: the
    // additive `ended` field distinguishes "this bingo just finished" from
    // "no bingo has ever run" — a real, sourced distinction (name+endDate),
    // not a fake-empty state. Anonymous-safe: no team data leaks here.
    if (board?.ended) {
      const { name, endDate } = board.ended;
      const endedLabel = endDate
        ? new Date(endDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : null;
      return (
        <PageLayout title="Bingo Board" align="center">
          <Stack
            spacing={1.5}
            sx={{
              alignItems: 'flex-start',
              textAlign: 'left',
              width: '100%',
              py: 4,
              color: appColors.textSecondary,
            }}
          >
            <EmojiEventsIcon sx={{ fontSize: 48, color: appColors.mutedText }} />
            <Typography variant="h6">
              {name} has ended{endedLabel ? ` ${endedLabel}` : ''}
            </Typography>
            <Typography variant="body2" sx={{ color: appColors.textSecondary, maxWidth: 420 }}>
              Check back once the next bingo kicks off.
            </Typography>
          </Stack>
        </PageLayout>
      );
    }

    return (
      <PageLayout title="Bingo Board" align="center">
        <Stack
          spacing={1.5}
          sx={{
            alignItems: 'flex-start',
            textAlign: 'left',
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

  const { bingo, myTeam } = board;
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
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'flex-start',
        }}
      >
        <Box
          role="group"
          aria-label={`${bingo.name} board, ${tiles.length} tiles`}
          sx={{
            display: 'grid',
            width: '100%',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: { xs: 1, sm: 1.5 },
          }}
        >
          {tiles.map((tile) => (
            <BingoTile
              key={tile.id}
              task={tile.task}
              completed={tile.completedByMyTeam}
              pendingByMyTeam={tile.pendingByMyTeam}
              myTeamName={myTeam?.name}
              points={tile.points}
              type={tile.type}
              targetValue={tile.targetValue}
            />
          ))}
        </Box>
      </Box>
    </PageLayout>
  );
};

export default BingoBoard;
