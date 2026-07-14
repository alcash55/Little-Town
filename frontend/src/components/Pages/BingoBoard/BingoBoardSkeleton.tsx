import { Box, Skeleton, Stack } from '@mui/material';
import { appColors } from '../../../layout/Theme';

// A 5x5 board is the largest real board size (see BingoDetails' size picker),
// so this shape is a representative stand-in while the real tile count is
// still unknown.
const SKELETON_COLUMNS = 5;
const SKELETON_TILES = 25;

/**
 * Loading state for the board page. A skeleton grid (rather than a bare
 * spinner) previews the real layout — hero header + square tile grid — so
 * the page doesn't visually "jump" once data arrives.
 */
export const BingoBoardSkeleton = () => (
  <Stack spacing={2} sx={{ width: '100%', alignItems: 'center' }}>
    <Box
      sx={{
        width: '100%',
        borderRadius: 3,
        border: `1px solid ${appColors.subtleBorder}`,
        p: { xs: 2.5, sm: 3.5 },
        boxSizing: 'border-box',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Stack spacing={1}>
          <Skeleton
            variant="text"
            width={220}
            height={44}
            sx={{ bgcolor: appColors.subtleBorder }}
          />
          <Skeleton
            variant="rounded"
            width={140}
            height={28}
            sx={{ bgcolor: appColors.subtleBorder, borderRadius: 4 }}
          />
        </Stack>
        <Skeleton
          variant="rounded"
          width={200}
          height={36}
          sx={{ bgcolor: appColors.subtleBorder, borderRadius: 2 }}
        />
      </Stack>
    </Box>

    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${SKELETON_COLUMNS}, 1fr)`,
        gap: { xs: 1, sm: 1.5 },
        width: '100%',
        // Matches BingoBoard's own widened column (see BOARD_MAX_WIDTH in
        // BingoBoard.tsx) so the skeleton-to-real-board handoff doesn't
        // visibly resize.
        maxWidth: 1100,
      }}
    >
      {Array.from({ length: SKELETON_TILES }).map((_, i) => (
        // Skeleton sizes itself from its own default height rather than the
        // grid cell, so `aspectRatio` on the Skeleton itself is ignored —
        // give it a square wrapper and have it fill that instead.
        <Box key={i} sx={{ aspectRatio: '1', width: '100%' }}>
          <Skeleton
            variant="rounded"
            width="100%"
            height="100%"
            sx={{ borderRadius: 2, bgcolor: appColors.subtleBorder }}
          />
        </Box>
      ))}
    </Box>
  </Stack>
);
