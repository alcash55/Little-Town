import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { SvgIconComponent } from '@mui/icons-material';
import { PlayerRow, TileInfo } from './useTeamData';

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function fmtProgress(val: number, type: TileInfo['type']): string {
  if (type === 'Experience') {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}m xp`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k xp`;
    return `${val} xp`;
  }
  return `${val} kc`;
}

/** One shared vocabulary for every status cell, table or mobile. */
export type CellState = 'complete' | 'approved' | 'inProgress' | 'pending' | 'none';

export type TileCellData = {
  state: CellState;
  /** Short text shown next to the icon in the cell itself — never icon-only. */
  label: string;
  /** Fuller text for the tooltip / accessible description. */
  detail: string;
};

/**
 * Status is a fixed, reserved vocabulary — always icon + visible label so
 * state never rides on color alone (matches DependencyHealthSection's
 * STATUS_META convention on the BingoOverview page). Colors are MUI theme
 * status tokens (palette.success/info/warning/text), not new hex.
 */
export const CELL_STATE_META: Record<
  CellState,
  { icon: SvgIconComponent; color: string; srLabel: string }
> = {
  complete: { icon: CheckCircleIcon, color: 'success.main', srLabel: 'Complete' },
  approved: { icon: CheckCircleIcon, color: 'success.main', srLabel: 'Approved' },
  inProgress: { icon: TrendingUpIcon, color: 'info.main', srLabel: 'In progress' },
  pending: { icon: HourglassEmptyIcon, color: 'warning.main', srLabel: 'Pending review' },
  none: { icon: RadioButtonUncheckedIcon, color: 'text.secondary', srLabel: 'Not started' },
};

/** Resolve a single player × tile intersection into a renderable cell. */
export function getTileCell(tile: TileInfo, player: PlayerRow): TileCellData {
  if (tile.type === 'Drops') {
    // GET /my-team-data's dropStatus is keyed by the tile's real-cased task
    // (fixed at the source in backend/src/routes/bingo.ts — see Sprint 11
    // candidates, todo.md ~line 132; used to be lowercased, requiring a
    // frontend fallback that's no longer needed).
    const status = player.dropStatus[tile.task];
    if (status === 'approved') {
      return { state: 'approved', label: 'Approved', detail: `${tile.task}: drop approved` };
    }
    if (status === 'pending') {
      return {
        state: 'pending',
        label: 'Pending',
        detail: `${tile.task}: screenshot submitted, awaiting review`,
      };
    }
    return { state: 'none', label: '—', detail: `${tile.task}: no submission yet` };
  }

  const val =
    tile.type === 'Experience'
      ? player.skillDeltas[tile.task] ?? 0
      : player.activityDeltas[tile.task] ?? 0;

  if (!val) {
    return { state: 'none', label: '—', detail: `${tile.task}: no progress yet` };
  }

  const progressText = fmtProgress(val, tile.type);
  const pct = tile.target ? Math.min(100, Math.round((val / tile.target) * 100)) : null;
  const isComplete = tile.target ? val >= tile.target : false;

  if (isComplete) {
    return {
      state: 'complete',
      label: progressText,
      detail: `${tile.task}: ${progressText} — target met`,
    };
  }

  return {
    state: 'inProgress',
    label: pct !== null ? `${progressText} · ${pct}%` : progressText,
    detail: `${tile.task}: ${progressText}${
      pct !== null ? ` — ${pct}% of target` : ' logged so far'
    }`,
  };
}

export const tileTypeColor = (type: TileInfo['type']) =>
  type === 'Experience' ? '#64b4ff' : type === 'Kill Count' ? '#ffa050' : '#b39ddb';

export const tileTarget = (tile: TileInfo) => {
  if (tile.type === 'Drops' || !tile.target) return null;
  return tile.type === 'Experience' ? fmtProgress(tile.target, tile.type) : `${tile.target} kc`;
};
