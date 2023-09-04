import React, { useState, useEffect } from 'react';
import Typography from '@mui/material';
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
      <>
        <svg viewBox="0 0 400 400" width="100%" height="100%">
          {currentTime.map((t: number, idx: number) => (
            <React.Fragment key={idx}>
              <VictoryPie
                standalone
                animate={{ duration: 1000 }}
                data={[
                  { x: unit[idx], y: percentages[idx] }, // Use the unit as x and percentage as y
                  { x: 'Remaining', y: 100 - percentages[idx] }, // Remaining percentage
                ]}
                innerRadius={120}
                cornerRadius={25}
                colorScale={['#4caf50', '#f44336']}
              />
              <VictoryAnimation duration={1000} data={{ y: t }}>
                {(animatedProps) => (
                  <VictoryLabel
                    textAnchor="middle"
                    verticalAnchor="middle"
                    x={200}
                    y={200}
                    text={`${animatedProps.y}${unit[idx]}`}
                    style={{ fontSize: 45 }}
                  />
                )}
              </VictoryAnimation>
            </React.Fragment>
          ))}
        </svg>
      </>
    );
  };

  const timeData = formatTime(timeRemaining);

  return <>{timeData}</>;
};
