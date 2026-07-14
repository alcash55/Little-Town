import { Box, Tooltip, Typography } from '@mui/material';
import { appColors } from '../../../layout/Theme';
import { CELL_STATE_META, TileCellData } from './helpers';

/**
 * Compact per-tile status cell: icon + short visible label (never icon-only,
 * never color-only) with the full detail in a tooltip. `tabIndex` + a
 * focus-visible ring make the tooltip reachable by keyboard, not just hover
 * (MUI's Tooltip already opens on focus for a focusable child).
 */
export function TileStatusCell({ cell }: { cell: TileCellData }) {
  const meta = CELL_STATE_META[cell.state];
  const Icon = meta.icon;
  return (
    <Tooltip title={cell.detail} arrow>
      <Box
        component="span"
        tabIndex={0}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.75,
          py: 0.5,
          borderRadius: 1,
          outline: 'none',
          '&:focus-visible': { boxShadow: `0 0 0 2px ${appColors.accent}` },
        }}
      >
        <Icon aria-hidden sx={{ fontSize: 16, color: meta.color, flexShrink: 0 }} />
        <Typography
          variant="caption"
          sx={{ fontSize: 11, color: appColors.textSecondary, whiteSpace: 'nowrap' }}
        >
          {cell.label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
