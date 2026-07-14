import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StarIcon from '@mui/icons-material/Star';
import { appColors } from '../../../layout/Theme';
import { PlayerRow, TileInfo } from './useTeamData';
import { fmtDate, getTileCell, tileTarget, tileTypeColor } from './helpers';
import { CELL_STATE_META } from './helpers';

const PlayerPanel = ({ player, tiles }: { player: PlayerRow; tiles: TileInfo[] }) => (
  <Accordion
    disableGutters
    sx={{
      width: '100%',
      bgcolor: 'background.paper',
      border: `1px solid ${appColors.subtleBorder}`,
      '&:before': { display: 'none' },
    }}
  >
    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: appColors.mutedText }} />}>
      <Stack sx={{ width: '100%' }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          {player.isCaptain && (
            <Tooltip title="Team Captain">
              <StarIcon sx={{ fontSize: 14, color: '#FFD700', flexShrink: 0 }} />
            </Tooltip>
          )}
          <Typography variant="body2" sx={{ color: appColors.textPrimary, fontWeight: 600 }}>
            {player.rsn}
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: appColors.mutedText }}>
          {player.snapshotTakenAt ? `Synced ${fmtDate(player.snapshotTakenAt)}` : 'No snapshot yet'}
        </Typography>
      </Stack>
    </AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}>
      <Stack divider={<Stack sx={{ borderTop: `1px solid rgba(255,255,255,0.05)` }} />}>
        {tiles.map((tile) => {
          const cell = getTileCell(tile, player);
          const meta = CELL_STATE_META[cell.state];
          const Icon = meta.icon;
          const target = tileTarget(tile);
          return (
            <Stack
              key={tile.task}
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', py: 0.75 }}
            >
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{ color: appColors.textPrimary, fontSize: 13, fontWeight: 500 }}
                >
                  {tile.task}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: tileTypeColor(tile.type), fontSize: 10 }}
                >
                  {tile.type}
                  {target && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ color: appColors.mutedText, fontSize: 10 }}
                    >
                      {' '}
                      · {target}
                    </Typography>
                  )}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
                <Icon aria-hidden sx={{ fontSize: 16, color: meta.color }} />
                <Typography
                  variant="caption"
                  sx={{ color: appColors.textSecondary, fontSize: 11, whiteSpace: 'nowrap' }}
                >
                  {cell.label}
                </Typography>
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </AccordionDetails>
  </Accordion>
);

export type TeamDataMobileListProps = {
  tiles: TileInfo[];
  players: PlayerRow[];
};

/**
 * Mobile strategy: a pinched 10-player × 20-tile grid is unusable at 390px —
 * an accordion per player (collapsed by default) beats it, since a phone
 * user is almost always checking one player (usually themselves) at a time,
 * not scanning the whole team like on desktop.
 */
export function TeamDataMobileList({ tiles, players }: TeamDataMobileListProps) {
  return (
    <Stack spacing={1} sx={{ width: '100%' }}>
      {players.map((p) => (
        <PlayerPanel key={p.playerId} player={p} tiles={tiles} />
      ))}
    </Stack>
  );
}
