import {
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { appColors } from '../../../layout/Theme';
import { PlayerRow, TileInfo } from './useTeamData';
import { fmtDate, getTileCell, tileTarget, tileTypeColor } from './helpers';
import { TileStatusCell } from './TileStatusCell';

const TILE_COL_WIDTH = 220;
const PLAYER_COL_WIDTH = 132;

const surfaceSx = { bgcolor: 'background.paper' } as const;

// ─── Sticky top-left corner ─────────────────────────────────────────────────
const CornerCell = () => (
  <TableCell
    component="th"
    scope="col"
    sx={{
      ...surfaceSx,
      position: 'sticky',
      left: 0,
      top: 0,
      zIndex: 3,
      minWidth: TILE_COL_WIDTH,
      maxWidth: TILE_COL_WIDTH,
      borderBottom: `1px solid ${appColors.subtleBorder}`,
      borderRight: `1px solid ${appColors.subtleBorder}`,
    }}
  >
    <Typography
      variant="caption"
      sx={{
        color: appColors.textSecondary,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontSize: 11,
      }}
    >
      Tile
    </Typography>
  </TableCell>
);

// ─── Player column header ───────────────────────────────────────────────────
const PlayerHeaderCell = ({ player }: { player: PlayerRow }) => (
  <TableCell
    component="th"
    scope="col"
    align="center"
    sx={{
      ...surfaceSx,
      position: 'sticky',
      top: 0,
      zIndex: 2,
      minWidth: PLAYER_COL_WIDTH,
      borderBottom: `1px solid ${appColors.subtleBorder}`,
    }}
  >
    <Stack spacing={0} sx={{ alignItems: 'center' }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        {player.isCaptain && (
          <Tooltip title="Team Captain">
            <StarIcon sx={{ fontSize: 13, color: '#FFD700', flexShrink: 0 }} />
          </Tooltip>
        )}
        <Typography
          variant="body2"
          sx={{ color: appColors.textPrimary, fontWeight: 600, fontSize: 13 }}
        >
          {player.rsn}
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: appColors.mutedText, fontSize: 10 }}>
        {player.snapshotTakenAt ? fmtDate(player.snapshotTakenAt) : 'No snapshot yet'}
      </Typography>
    </Stack>
  </TableCell>
);

// ─── Tile row header (sticky first column) ──────────────────────────────────
const TileRowHeader = ({ tile }: { tile: TileInfo }) => {
  const target = tileTarget(tile);
  return (
    <TableCell
      component="th"
      scope="row"
      sx={{
        ...surfaceSx,
        position: 'sticky',
        left: 0,
        zIndex: 1,
        minWidth: TILE_COL_WIDTH,
        maxWidth: TILE_COL_WIDTH,
        borderRight: `1px solid ${appColors.subtleBorder}`,
        borderBottom: `1px solid rgba(255,255,255,0.05)`,
      }}
    >
      <Tooltip title={tile.task} arrow disableInteractive>
        <Typography
          variant="body2"
          sx={{
            color: appColors.textPrimary,
            fontWeight: 600,
            fontSize: 13,
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {tile.task}
        </Typography>
      </Tooltip>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.25 }}>
        <Typography variant="caption" sx={{ color: tileTypeColor(tile.type), fontSize: 10 }}>
          {tile.type}
        </Typography>
        {target && (
          <Typography variant="caption" sx={{ color: appColors.mutedText, fontSize: 10 }}>
            · {target}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: appColors.mutedText, fontSize: 10 }}>
          · {tile.points}pt
        </Typography>
      </Stack>
    </TableCell>
  );
};

export type TeamDataTableProps = {
  tiles: TileInfo[];
  players: PlayerRow[];
};

/**
 * Desktop presentation: tiles as rows, players as columns. Board sizes run
 * 16–25 tiles (better as a scrolling row axis) against teams of ~2–10 (a
 * column count that comfortably fits a viewport width instead of the 16+
 * wide text columns the old per-player-row layout produced). The sticky tile
 * column keeps rows labeled as the player axis scrolls sideways.
 *
 * TEAM-BRIEF.md Sprint 17, Track B item 5: this used to cap itself at a
 * fixed `maxHeight` (62vh), which made `TableContainer` establish its own
 * vertical scroll region nested inside PageLayout's already-scrollable page
 * — a full 16–25-tile board was stuck scrolling through a cramped inner
 * pane even on desktop/tablet, where there was room to just show more of
 * the board. Dropping the vertical cap removes that inner scrollbar: the
 * table lays out to its natural height and the page itself scrolls, like
 * every other page in the app.
 *
 * TRADEOFF, deliberate: `stickyHeader`'s player row no longer sticks. MUI's
 * `TableContainer` sets `overflow-x: auto`, and CSS computes the other axis
 * from `visible` to `auto` when one axis is not `visible` — so this element
 * stays the nearest scrollport for `position: sticky` even with no height
 * cap. It simply never scrolls vertically anymore, so a `top`-stuck header
 * has nothing to stick against and rides up with the page. Making it stick
 * to the *page* would require `overflow: visible` here, which would forfeit
 * horizontal scrolling for wide teams (PageLayout sets `overflowX: hidden`,
 * so those columns would be clipped and unreachable). Horizontal scroll for
 * many-player teams is worth more than a stuck header, so `stickyHeader`
 * stays only for the sticky *left* tile column, which still works — that
 * axis does still scroll here.
 */
export function TeamDataTable({ tiles, players }: TeamDataTableProps) {
  return (
    <TableContainer
      sx={{
        width: '100%',
        border: `1px solid ${appColors.subtleBorder}`,
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Table stickyHeader size="small" sx={{ borderCollapse: 'separate', width: '100%' }}>
        <TableHead>
          <TableRow>
            <CornerCell />
            {players.map((p) => (
              <PlayerHeaderCell key={p.playerId} player={p} />
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {tiles.map((tile) => (
            <TableRow
              key={tile.task}
              sx={{ '&:hover .team-data-cell': { bgcolor: 'rgba(42,157,143,0.06)' } }}
            >
              <TileRowHeader tile={tile} />
              {players.map((p) => (
                <TableCell
                  key={p.playerId}
                  align="center"
                  className="team-data-cell"
                  sx={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}
                >
                  <TileStatusCell cell={getTileCell(tile, p)} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
