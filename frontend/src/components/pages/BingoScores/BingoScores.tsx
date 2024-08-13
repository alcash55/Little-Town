import { Box, Typography } from '@mui/material';
import { VictoryChart, VictoryLine, VictoryLegend, VictoryAxis, Curve } from 'victory';
import { darkTheme } from '../../../layout/Theme';
import { useBingoScores } from './useBingoScores';

interface DataPoint {
  x: Date;
  y: number;
}

const BingoScores = () => {
  const teamColors = ['#39f76c', '#854cc2', '#d95f27'];
  const teamNames = ['Based Cigar', 'Gorilla Grip Bussies', 'Stark Industries'];
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
    // Add more lines if needed
  ];

  useBingoScores();

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        bgcolor: darkTheme.palette.primary.main,
        p: 10,
      }}
    >
      <Typography p={3} variant="h1">
        Total Team XP
      </Typography>

      <VictoryChart>
        {chartData.map((line, index) => (
          <VictoryLine
            key={index}
            data={line}
            dataComponent={<Curve tabIndex={0} />}
            interpolation={'natural'}
            style={{ data: { stroke: teamColors[index] } }}
          />
        ))}

        {/* X-Axis */}
        {/* <VictoryAxis
          tickFormat={(x) => new Date(x).toLocaleDateString()}
          style={{
            tickLabels: { fontSize: 12, padding: 5, color: 'red' },
            grid: { stroke: 'black', axis: 'black' },
            axis: { stroke: 'black' },
          }}
        /> */}

        {/* Y-Axis */}
        <VictoryAxis
          tickValues={[0, 500000, 1000000, 1500000, 2000000, 2500000, 3000000]}
          dependentAxis
          style={{
            tickLabels: { fontSize: 12, padding: 5, color: 'red' },
            axis: { stroke: 'black' },
          }}
        />
        <VictoryLegend
          x={15}
          y={10}
          orientation="horizontal"
          gutter={20}
          style={{
            border: { stroke: 'black' },
            title: { fill: 'black' },
            labels: { fill: 'black' },
          }}
          data={teamNames.map((name, index) => ({ name, symbol: { fill: teamColors[index] } }))}
        />
      </VictoryChart>
    </Box>
  );
};

export default BingoScores;
