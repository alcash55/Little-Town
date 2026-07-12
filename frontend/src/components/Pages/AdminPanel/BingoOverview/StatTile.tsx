import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { appColors } from '../../../../layout/Theme';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';

export type StatTileProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
};

/**
 * A single headline number — dataviz skill's "stat tile" form for a current
 * value with no meaningful trend to plot. Icon carries category identity so
 * the value itself never needs a color to be legible.
 */
export const StatTile = ({ icon, label, value, sub }: StatTileProps) => (
  <Card sx={{ flex: '1 1 160px', minWidth: 160 }}>
    <CardContent sx={{ pb: '12px !important' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Box sx={{ color: appColors.accent, display: 'flex' }}>{icon}</Box>
        <Typography variant="body2" sx={{ color: textSecondary }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontFamily: "'pacifico', cursive" }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: textSecondary }}>
          {sub}
        </Typography>
      )}
    </CardContent>
  </Card>
);
