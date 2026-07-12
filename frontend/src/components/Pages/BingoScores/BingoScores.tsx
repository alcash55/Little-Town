import { useMemo } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { useBingoScores } from './useBingoScores';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { appColors } from '../../../layout/Theme';

// Fixed-order categorical palette (dataviz skill's validated default, dark
// steps — this app's dark surfaces are effectively the same #1a1a1a/#0d0d0d
// pair the palette was validated against). Assigned by index in a stable
// order, never re-cycled when a team drops out of view.
const CATEGORICAL_SERIES_COLORS = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
];

const compactXp = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

const BingoScores = () => {
  const { teams, loading, error, refetch } = useBingoScores();

  // Merge every team's series onto one shared, sorted set of dates so each
  // line's `data` array lines up index-for-index with the x-axis (MUI
  // x-charts' 'point' scale plots by position, not by value) — teams don't
  // necessarily share identical snapshot dates (e.g. a team added mid-bingo
  // has a shorter history), so a missing date becomes `null` (a gap in that
  // team's line) rather than misaligning every point after it.
  const { dates, series } = useMemo(() => {
    const dateSet = new Set<string>();
    for (const team of teams) {
      for (const point of team.series) dateSet.add(point.date);
    }
    const sortedDates = Array.from(dateSet).sort();
    const parsedDates = sortedDates.map((iso) => new Date(iso));

    const chartSeries = teams.map((team, index) => {
      const byDate = new Map(team.series.map((point) => [point.date, point.totalXpGained]));
      return {
        id: team.teamId,
        label: team.teamName,
        data: sortedDates.map((iso) => byDate.get(iso) ?? null),
        color: CATEGORICAL_SERIES_COLORS[index % CATEGORICAL_SERIES_COLORS.length],
        curve: 'natural' as const,
        showMark: true,
        connectNulls: true,
      };
    });

    return { dates: parsedDates, series: chartSeries };
  }, [teams]);

  const hasHistory = dates.length > 0 && series.some((s) => s.data.some((v) => v !== null));

  if (loading) {
    return (
      <PageLayout title="Total Team XP" align="center">
        <CircularProgress sx={{ color: appColors.accent }} />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Total Team XP" align="center">
        <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={() => void refetch()} sx={{ mt: 2 }}>
          Retry
        </Button>
      </PageLayout>
    );
  }

  if (!hasHistory) {
    return (
      <PageLayout title="Total Team XP" align="center">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 4 }}>
          <ShowChartIcon sx={{ fontSize: 48, color: appColors.mutedText }} />
          <Typography variant="h6">No team XP history yet</Typography>
          <Typography variant="body2" sx={{ color: appColors.textSecondary, textAlign: 'center', maxWidth: 420 }}>
            Once the bingo is active and player snapshots start rolling in, each team's total XP
            gained will show up here.
          </Typography>
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Total Team XP" maxWidth="full">
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <LineChart
          height={400}
          xAxis={[
            {
              data: dates,
              // 'point' scale => exactly one evenly-spaced tick per data point.
              // A continuous 'time' scale generated extra sub-day ticks that
              // duplicated the same "Jul 23" label multiple times in a row.
              scaleType: 'point',
              valueFormatter: (date: Date) =>
                date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            },
          ]}
          yAxis={[
            {
              min: 0,
              valueFormatter: (value: number) => compactXp.format(value),
            },
          ]}
          series={series}
          grid={{ horizontal: true }}
          sx={{
            '& .MuiChartsAxis-tickLabel': { fill: appColors.textSecondary },
            '& .MuiChartsAxis-line': { stroke: appColors.subtleBorder },
            '& .MuiChartsAxis-tick': { stroke: appColors.subtleBorder },
            '& .MuiChartsLegend-series text': { fill: appColors.textPrimary },
            '& .MuiChartsGrid-line': { stroke: 'rgba(255,255,255,0.08)' },
          }}
        />
      </Box>
    </PageLayout>
  );
};

export default BingoScores;
