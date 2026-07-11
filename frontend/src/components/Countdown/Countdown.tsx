import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
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
    <Stack spacing={1} sx={{ alignItems: 'center' }}>
      {label && (
        <Typography variant="h2" sx={{ fontSize: { xs: 20, sm: 26 }, textAlign: 'center' }}>
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        {segments.map(({ value, unit, max }) => (
          <Gauge
            key={unit}
            width={80}
            height={80}
            value={value}
            valueMin={0}
            valueMax={max}
            innerRadius="70%"
            outerRadius="100%"
            cornerRadius="50%"
            text={() => `${value}${unit}`}
            aria-label={`${value} ${
              unit === 'd' ? 'days' : unit === 'h' ? 'hours' : unit === 'm' ? 'minutes' : 'seconds'
            } remaining`}
            sx={{
              [`& .${gaugeClasses.referenceArc}`]: {
                fill: 'rgba(255,255,255,0.12)',
              },
              [`& .${gaugeClasses.valueArc}`]: {
                fill: '#2A9D8F',
              },
              [`& .${gaugeClasses.valueText}`]: {
                fontFamily: "'pacifico', cursive",
                fontSize: 14,
                fill: '#ffffff',
              },
            }}
          />
        ))}
      </Box>
    </Stack>
  );
};
