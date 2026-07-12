import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { appColors } from '../../../../layout/Theme';
import { textSecondary } from '../TeamDrafter/teamDrafterStyles';
import { PlayerStat } from './useBingoOverview';

export type TeamPointsChartProps = {
  playerStats: PlayerStat[];
};

/**
 * Points scored per team — a magnitude comparison across a handful of
 * categories, so per dataviz's form heuristic this stays a single accent hue
 * (sequential job) rather than a categorical palette: the teams themselves
 * aren't the story, their relative standing is.
 */
export const TeamPointsChart = ({ playerStats }: TeamPointsChartProps) => {
  const rows = useMemo(() => {
    const byTeam = new Map<string, number>();
    for (const p of playerStats) {
      const key = p.teamName || 'Unassigned';
      byTeam.set(key, (byTeam.get(key) ?? 0) + p.totalPoints);
    }
    return Array.from(byTeam.entries())
      .map(([team, points]) => ({ team, points }))
      .sort((a, b) => b.points - a.points);
  }, [playerStats]);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: textSecondary, py: 2 }}>
        No team scores yet.
      </Typography>
    );
  }

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <BarChart
        height={Math.max(120, rows.length * 44)}
        layout="horizontal"
        hideLegend
        yAxis={[{ scaleType: 'band', data: rows.map((r) => r.team) }]}
        xAxis={[{ min: 0 }]}
        series={[
          {
            data: rows.map((r) => r.points),
            label: 'Points',
            color: appColors.accent,
            barLabel: 'value',
          },
        ]}
        grid={{ vertical: true }}
        margin={{ left: 110 }}
        sx={{
          '& .MuiChartsAxis-tickLabel': { fill: textSecondary },
          '& .MuiChartsAxis-line': { stroke: appColors.subtleBorder },
          '& .MuiChartsAxis-tick': { stroke: appColors.subtleBorder },
          '& .MuiChartsGrid-line': { stroke: 'rgba(255,255,255,0.08)' },
          '& .MuiBarLabel-root': { fill: appColors.textPrimary },
        }}
        borderRadius={4}
      />
    </Box>
  );
};
