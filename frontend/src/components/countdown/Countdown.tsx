import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { VictoryPie, VictoryLabel } from 'victory';
import '@fontsource/pacifico';

interface CountdownProps {
  targetDate: Date;
}

export const Countdown: React.FC<CountdownProps> = ({ targetDate }) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentTime = new Date().getTime();
      const timeDiff = targetDate.getTime() - currentTime;
      if (timeDiff > 0) {
        setTimeRemaining(timeDiff);
      } else {
        // Countdown has reached its target, you can handle this as needed
        clearInterval(intervalId);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [targetDate]);

  const formatTime = (time: number) => {
    // converts the range to stay between 0-59
    const seconds = Math.floor((time / 1000) % 60);
    const minutes = Math.floor((time / 1000 / 60) % 60);
    const hours = Math.floor((time / (1000 * 60 * 60)) % 24);
    const days = Math.floor(time / (1000 * 60 * 60 * 24));

    const currentTime = [days, hours, minutes, seconds];
    const unit = ['d', 'h', 'm', 's'];

    return (
      <Stack justifyContent={'center'} alignItems={'center'}>
        <Typography variant="h1" fontSize={38}>
          Countdown to the next bingo!
        </Typography>
        <Box display={'flex'}>
          {currentTime.map((t: number, idx: number) => (
            <svg key={idx} viewBox="0 0 50 50" width="100%" height="100%">
              <VictoryPie
                standalone={false}
                colorScale={['gray']}
                data={[{ y: 59 }]}
                width={50}
                height={50}
                innerRadius={13}
                radius={15}
                labels={() => null}
              />
              <VictoryPie
                standalone={false}
                colorScale={['green', 'transparent']}
                data={[{ y: 59 - t }, { y: t }]}
                width={50}
                height={50}
                innerRadius={13}
                radius={15}
                labels={() => null}
                labelComponent={
                  <VictoryLabel
                    textAnchor={'middle'}
                    verticalAnchor={'middle'}
                    y={25}
                    x={25}
                    text={`${t}${unit[idx]}`}
                    style={{
                      fill: 'black',
                      fontSize: 8,
                      fontFamily: "'pacifico', cursive",
                      fontWeight: 25,
                    }}
                  />
                }
              />
            </svg>
          ))}
        </Box>
      </Stack>
    );
  };

  const timeData = formatTime(timeRemaining);

  return <>{timeData}</>;
};
