import { Stack, Typography } from '@mui/material';
import { appColors } from '../../../layout/Theme';
import { CELL_STATE_META } from './helpers';

const ENTRIES: Array<{ label: string; state: keyof typeof CELL_STATE_META }> = [
  { label: 'Complete / approved', state: 'complete' },
  { label: 'In progress', state: 'inProgress' },
  { label: 'Pending review', state: 'pending' },
  { label: 'Not started', state: 'none' },
];

/** Spells out what each icon means once, up front, instead of relying on hover-only tooltips. */
export function StatusLegend() {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ flexWrap: 'wrap', alignItems: 'center', rowGap: 0.5 }}
    >
      {ENTRIES.map(({ label, state }) => {
        const meta = CELL_STATE_META[state];
        const Icon = meta.icon;
        return (
          <Stack key={state} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Icon aria-hidden sx={{ fontSize: 14, color: meta.color }} />
            <Typography variant="caption" sx={{ color: appColors.mutedText, fontSize: 11 }}>
              {label}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}
