import { Box, Typography } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import { appColors } from '../../../../layout/Theme';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';

export type BoardProgressGaugeProps = {
  pointsScored: number;
  pointsPossible: number;
};

/**
 * A single ratio against a limit — dataviz's "Meter" form, not a chart. One
 * accent-hue track; the reference arc uses the same subtle border token as
 * the rest of the page's chrome, not a new hardcoded gray.
 */
export const BoardProgressGauge = ({ pointsScored, pointsPossible }: BoardProgressGaugeProps) => {
  if (pointsPossible <= 0) {
    return (
      <Typography variant="body2" sx={{ color: textSecondary, py: 2 }}>
        Board has no scoreable tiles yet.
      </Typography>
    );
  }

  const pct = Math.min(100, Math.round((pointsScored / pointsPossible) * 100));
  const exceedsMax = pointsScored > pointsPossible;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <Gauge
        width={180}
        height={140}
        value={Math.min(pointsScored, pointsPossible)}
        valueMin={0}
        valueMax={pointsPossible}
        startAngle={-110}
        endAngle={110}
        text={() => `${pct}%`}
        sx={{
          [`& .${gaugeClasses.valueArc}`]: { fill: appColors.accent },
          [`& .${gaugeClasses.referenceArc}`]: { fill: 'rgba(255,255,255,0.08)' },
          [`& .${gaugeClasses.valueText} text`]: {
            fill: appColors.textPrimary,
            fontSize: 24,
            fontWeight: 600,
          },
        }}
      />
      <Typography variant="caption" sx={{ color: textSecondary, textAlign: 'center', maxWidth: 260 }}>
        {exceedsMax
          ? `${pointsScored.toLocaleString()} pts scored — over the ${pointsPossible.toLocaleString()}-pt board max because more than one player can complete the same tile.`
          : `${pointsScored.toLocaleString()} / ${pointsPossible.toLocaleString()} possible points`}
      </Typography>
    </Box>
  );
};
