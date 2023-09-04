import React, { useState, useEffect } from 'react';
import Typography, { Box } from '@mui/material';
import { VictoryPie, VictoryAnimation, VictoryLabel } from 'victory';

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
    const seconds = Math.floor((time / 1000) % 60);
    const minutes = Math.floor((time / 1000 / 60) % 60);
    const hours = Math.floor((time / (1000 * 60 * 60)) % 24);
    const days = Math.floor(time / (1000 * 60 * 60 * 24));

    const currentTime = [days, hours, minutes, seconds];
    const unit = ['d', 'h', 'm', 's'];

    // Calculate percentages for each time unit
    const totalSeconds = days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds;
    const percentages = currentTime.map((t: number) => (t / totalSeconds) * 100);

    return (
      <Box display={'flex'} width={'100%'}>
        {currentTime.map((t: number, idx: number) => (
          <svg viewBox="0 0 200 200" width="100%" height="100%">
            <React.Fragment key={idx}>
              <VictoryPie
                standalone={false}
                colorScale={['gray']}
                data={[{ y: 360 }]}
                width={100}
                height={100}
                innerRadius={50}
                radius={25}
                labels={() => null}
              />
              <VictoryPie
                standalone={false}
                colorScale={['brown', 'transparent']}
                data={[{ y: 360 }, { y: 360 - percentages[idx] }]}
                width={100}
                height={100}
                innerRadius={50}
                radius={25}
                labels={() => null}
              />
              <VictoryLabel
                textAnchor={'middle'}
                x={50}
                y={175}
                text={`${t}${unit[idx]}`}
                style={{ fill: 'black' }}
              />
            </React.Fragment>
          </svg>
        ))}
      </Box>
    );
  };

  const timeData = formatTime(timeRemaining);

  return <>{timeData}</>;
};

{
  /* <VictoryPie
                standalone={false}
                animate={{ duration: 2000 }}
                data={[
                  { x: unit[idx], y: percentages[idx] }, // Use the unit as x and percentage as y
                  { x: 'Remaining', y: 360 - percentages[idx] }, // Remaining percentage
                ]}
                innerRadius={120}
                cornerRadius={25}
                colorScale={['#4caf50', '#f44336']}
                labels={() => null}
              />

              <VictoryAnimation duration={1000} data={{ y: t }}>
                {(animatedProps) => (
                  <VictoryLabel
                    textAnchor="middle"
                    verticalAnchor="middle"
                    x={location[idx]}
                    y={300}
                    text={`${animatedProps.y}${unit[idx]}`}
                    style={{ fontSize: 45 }}
                  />
                )}
              </VictoryAnimation> */
}
