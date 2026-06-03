import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { VictoryPie, VictoryLabel } from 'victory';
import '@fontsource/pacifico';

interface CountdownProps {
  targetDate: Date;
  label?: string;
}

export const Countdown: React.FC<CountdownProps> = ({
  targetDate,
  label = 'Countdown to the next bingo!',
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(
    Math.max(0, targetDate.getTime() - Date.now()),
  );

  useEffect(() => {
    setTimeRemaining(Math.max(0, targetDate.getTime() - Date.now()));

    const intervalId = setInterval(() => {
      const diff = targetDate.getTime() - Date.now();
      if (diff > 0) {
        setTimeRemaining(diff);
      } else {
        setTimeRemaining(0);
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [targetDate]);

  const seconds = Math.floor((timeRemaining / 1000) % 60);
  const minutes = Math.floor((timeRemaining / 1000 / 60) % 60);
  const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));

  const segments = [
    { value: days, unit: 'd', max: 365 },
    { value: hours, unit: 'h', max: 24 },
    { value: minutes, unit: 'm', max: 60 },
    { value: seconds, unit: 's', max: 60 },
  ];

  return (
    <Stack alignItems="center" spacing={1}>
      {label && (
        <Typography variant="h2" sx={{ fontSize: { xs: 20, sm: 26 }, textAlign: 'center' }}>
          {label}
        </Typography>
      )}
      <Box display="flex" justifyContent="center">
        {segments.map(({ value, unit, max }) => (
          <svg key={unit} viewBox="0 0 50 50" width="80px" height="80px">
            {/* Track */}
            <VictoryPie
              standalone={false}
              colorScale={['rgba(255,255,255,0.12)']}
              data={[{ y: 1 }]}
              width={50}
              height={50}
              innerRadius={13}
              radius={15}
              labels={() => null}
            />
            {/* Progress */}
            <VictoryPie
              standalone={false}
              colorScale={['#2A9D8F', 'transparent']}
              data={[{ y: value }, { y: max - value }]}
              width={50}
              height={50}
              innerRadius={13}
              radius={15}
              cornerRadius={30}
              labels={() => null}
            />
            {/* Label */}
            <VictoryLabel
              textAnchor="middle"
              verticalAnchor="middle"
              y={25}
              x={25}
              text={`${value}${unit}`}
              style={{
                fill: '#ffffff',
                fontSize: 7,
                fontFamily: "'pacifico', cursive",
              }}
            />
          </svg>
        ))}
      </Box>
    </Stack>
  );
};
