import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { VictoryPie, VictoryLabel, VictoryAnimation } from 'victory';

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
      <Box display={'flex'} width={'100%'}>
        {currentTime.map((t: number, idx: number) => (
          <svg key={idx} viewBox="0 0 200 200" width="100%" height="100%">
            <VictoryPie
              standalone={false}
              colorScale={['gray']}
              data={[{ y: 59 }]}
              width={100}
              height={100}
              innerRadius={50}
              radius={25}
              cornerRadius={25}
              labels={() => null}
            />
            <VictoryPie
              standalone={false}
              colorScale={['green', 'transparent']}
              data={[{ y: 59 - t }, { y: t }]}
              width={100}
              height={100}
              innerRadius={50}
              radius={25}
              labels={() => null}
              labelComponent={
                <VictoryLabel
                  textAnchor={'middle'}
                  verticalAnchor={'middle'}
                  y={50}
                  x={50}
                  text={`${t}${unit[idx]}`}
                  style={{ fill: 'black', fontSize: 20 }}
                />
              }
            />
          </svg>
        ))}
      </Box>
    );
  };

  const timeData = formatTime(timeRemaining);

  return <>{timeData}</>;
};
