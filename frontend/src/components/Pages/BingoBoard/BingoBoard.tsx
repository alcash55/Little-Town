import { useRef } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../layout/Theme';
import { useBingoBoard } from './useBingoBoard';
import { BingoBoardHeader } from './BingoBoardHeader';
import { BingoTile } from './BingoTile';
import { BingoBoardSkeleton } from './BingoBoardSkeleton';
import { useFitTileSize } from './useFitTileSize';

// Desktop tile-fit tuning (see useFitTileSize.ts). The `sm`-breakpoint gap
// (1.5 * 8px theme spacing) is what actually renders once fit-mode is
// active (it only ever engages at `sm`+), so it's hardcoded here rather
// than re-derived from the responsive `gap` value below.
const FIT_GAP_PX = 12;
// Below this, board text/art stops being legible — bail out to the
// original scrolling layout instead of squashing tiles further (e.g. a
// 10x10 board can't fit legibly).
const FIT_MIN_TILE_SIZE = 80;
// Cap so a small board on a tall monitor doesn't blow tiles up huge.
const FIT_MAX_TILE_SIZE = 180;
// Widened from the old 900px column — smaller-but-still-legible fit-mode
// tiles have room to breathe horizontally instead of leaving dead space
// either side (Alex's feedback); still a bounded, centered column, not
// edge-to-edge sprawl.
const BOARD_MAX_WIDTH = 1100;

const BingoBoard = () => {
  const { board, loading, error, refetch } = useBingoBoard();
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Boards are built as perfect squares (see BoardBuilder), so this recovers
  // a clean column count from the total tile count; an odd `boardSize` just
  // wraps the last row short via the grid's normal auto-flow rather than
  // breaking layout. Derived before the early returns below (rather than
  // after the `board.active` check) so `useFitTileSize` — a hook — can be
  // called unconditionally on every render.
  const tiles = board?.active ? board.tiles : [];
  const columns = Math.max(
    1,
    Math.round(Math.sqrt(tiles.length || (board?.active ? board.bingo.boardSize : 0) || 1)),
  );
  const rows = tiles.length > 0 ? Math.ceil(tiles.length / columns) : columns;

  // Desktop-only ("sm"+ breakpoint, gated inside the hook) tile auto-sizing
  // so the whole grid + header fits one screen — see useFitTileSize.ts.
  // Mobile keeps its original fixed, always-full-width grid untouched.
  const tileSize = useFitTileSize(gridContainerRef, {
    columns,
    rows,
    gapPx: FIT_GAP_PX,
    minTileSize: FIT_MIN_TILE_SIZE,
    maxTileSize: FIT_MAX_TILE_SIZE,
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

  const { bingo, myTeam } = board;
  const completedCount = tiles.filter((tile) => tile.completedByMyTeam).length;

  // Mobile strategy (unchanged): the board stays a full, non-scrolling-width
  // grid at every breakpoint (never horizontal-scroll or a stacked list) —
  // seeing every square at once is core to reading a bingo board. Real
  // boards top out at 5x5 (see BingoDetails' size picker), so even at 390px
  // wide, tiles scale down to ~60px squares rather than slivers;
  // padding/gap/font shrink at `xs` and long task text is always one
  // tap/click away in full via the tile's detail dialog.
  //
  // Desktop ("sm"+) instead sizes tiles from `tileSize` (see
  // useFitTileSize.ts above) so the whole grid + header fits one screen
  // without vertical scrolling. When `tileSize` is `null` — either a board
  // too large to fit legibly, or the hook hasn't measured yet — this falls
  // back to the original responsive `1fr`/aspect-ratio layout, which
  // scrolls instead of squashing tiles further.
  const fitStyles =
    tileSize != null
      ? {
          gridTemplateColumns: `repeat(${columns}, ${tileSize}px)`,
          gap: `${FIT_GAP_PX}px`,
        }
      : {
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: { xs: 1, sm: 1.5 },
        };

  return (
    <PageLayout title="Bingo Board" maxWidth="full">
      <BingoBoardHeader
        bingo={bingo}
        myTeam={myTeam}
        completedCount={completedCount}
        totalCount={tiles.length}
      />

      <Box
        ref={gridContainerRef}
        sx={{ width: '100%', maxWidth: BOARD_MAX_WIDTH, display: 'flex', justifyContent: 'center' }}
      >
        <Box
          role="group"
          aria-label={`${bingo.name} board, ${tiles.length} tiles`}
          sx={{
            display: 'grid',
            width: tileSize != null ? undefined : '100%',
            ...fitStyles,
          }}
        >
          {tiles.map((tile) => (
            <BingoTile
              key={tile.id}
              task={tile.task}
              completed={tile.completedByMyTeam}
              myTeamName={myTeam?.name}
              points={tile.points}
              type={tile.type}
              targetValue={tile.targetValue}
              size={tileSize ?? undefined}
            />
          ))}
        </Box>
      </Box>
    </PageLayout>
  );
};

export default BingoBoard;
