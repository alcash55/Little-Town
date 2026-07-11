import { Box } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useBingoScores } from './useBingoScores';
import PageLayout from '../../../layout/PageLayout/PageLayout';

interface DataPoint {
  x: Date;
  y: number;
}

const BingoScores = () => {
  const teamColors = ['#39f76c', '#854cc2', '#d95f27'];
  const teamNames = ['Team 1', 'Team 2', 'Team 3'];
  const chartData: DataPoint[][] = [
    [
      { x: new Date(2023, 6, 23), y: 0 },
      { x: new Date(2023, 6, 24), y: 100000 },
      { x: new Date(2023, 6, 25), y: 500000 },
      { x: new Date(2023, 6, 26), y: 950000 },
      { x: new Date(2023, 6, 27), y: 1700000 },
      { x: new Date(2023, 6, 28), y: 2700000 },
    ],
    [
      { x: new Date(2023, 6, 23), y: 0 },
      { x: new Date(2023, 6, 24), y: 75000 },
      { x: new Date(2023, 6, 25), y: 800000 },
      { x: new Date(2023, 6, 26), y: 1000500 },
      { x: new Date(2023, 6, 27), y: 1300000 },
      { x: new Date(2023, 6, 28), y: 2500000 },
    ],
    [
      { x: new Date(2023, 6, 23), y: 0 },
      { x: new Date(2023, 6, 24), y: 72000 },
      { x: new Date(2023, 6, 25), y: 600000 },
      { x: new Date(2023, 6, 26), y: 1000000 },
      { x: new Date(2023, 6, 27), y: 1500000 },
      { x: new Date(2023, 6, 28), y: 3000000 },
    ],
  ];

  // All three mock series share the same x-axis dates.
  const dates = chartData[0].map((point) => point.x);

  useBingoScores();

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
              max: 3_000_000,
              valueFormatter: (value: number) => `${(value / 1_000_000).toFixed(1)}m`,
            },
          ]}
          series={chartData.map((line, index) => ({
            id: teamNames[index],
            label: teamNames[index],
            data: line.map((point) => point.y),
            color: teamColors[index],
            curve: 'natural',
            showMark: true,
          }))}
          grid={{ horizontal: true }}
          sx={{
            '& .MuiChartsAxis-tickLabel': { fill: 'rgba(255,255,255,0.7)' },
            '& .MuiChartsAxis-line': { stroke: 'rgba(255,255,255,0.23)' },
            '& .MuiChartsAxis-tick': { stroke: 'rgba(255,255,255,0.23)' },
            '& .MuiChartsLegend-series text': { fill: '#fff' },
            '& .MuiChartsGrid-line': { stroke: 'rgba(255,255,255,0.08)' },
          }}
        />
      </Box>
    </PageLayout>
  );
};

export default BingoScores;
