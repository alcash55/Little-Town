import { useRef } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../layout/Theme';
import { useBingoBoard } from './useBingoBoard';
import { BingoBoardHeader } from './BingoBoardHeader';
import { BingoTile } from './BingoTile';
import { BingoBoardSkeleton } from './BingoBoardSkeleton';
import { useFitTileSize } from './useFitTileSize';

const BingoBoard = () => {
  const { board, loading, error, refetch } = useBingoBoard();

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const tiles = board?.active ? board.tiles : [];
  const columns = Math.max(
    1,
    Math.round(Math.sqrt(tiles.length || (board?.active ? board.bingo.boardSize : 0) || 1)),
  );
  const tileSize = useFitTileSize(gridContainerRef, {
    columns,
    rows: Math.ceil(tiles.length / columns) || columns,
    gapPx: 12,
    minTileSize: 56,
    maxTileSize: 360,
    enabled: Boolean(board?.active),
  });
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
            <Typography variant="h6">{name} has ended</Typography>
            {endedLabel && <Typography variant="body2">Scheduled end: {endedLabel}</Typography>}
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
    <Box
      component="section"
      aria-label="Bingo board"
      sx={{
        width: '100%',
        maxWidth: 1440,
        mx: 'auto',
        p: { xs: 2, sm: 2.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <BingoBoardHeader
        bingo={bingo}
        myTeam={myTeam}
        completedCount={completedCount}
        totalCount={tiles.length}
      />

      <Box
        ref={gridContainerRef}
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          role="group"
          aria-label={`${bingo.name} board, ${tiles.length} tiles`}
          sx={{
            display: 'grid',
            width: tileSize == null ? '100%' : 'auto',
            gridTemplateColumns:
              tileSize == null
                ? {
                    xs: `repeat(${Math.min(2, columns)}, minmax(0, 1fr))`,
                    sm: `repeat(${columns}, minmax(0, 1fr))`,
                  }
                : `repeat(${columns}, ${tileSize}px)`,
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
              size={tileSize ?? undefined}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default BingoBoard;
