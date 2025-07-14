import React, { ReactNode } from 'react';
import { Box } from '@mui/material';
import LittleTownAnimation from '../../assets/Images/LittleTownAnimation.gif';
import { darkTheme } from '../../layout/Theme';

interface Props {
  loading: boolean;
  children?: ReactNode;
  [key: string]: any;
  width: number;
  height: number;
}

export const LoadingContainer = ({ width, height, loading, children, ...rest }: Props) => {
  if (loading) {
    return (
      <Box
        display={'flex'}
        justifyContent={'center'}
        alignItems={'center'}
        height={'100vh'}
        overflow={'hidden'}
        p={0}
        sx={{ bgcolor: darkTheme.palette.secondary.main }}
      >
        <img
          src={LittleTownAnimation}
          alt="Loading..."
          height={320}
          width={189}
          style={{ borderRadius: '50%', objectFit: 'cover', width: width, height: height }}
        />
      </Box>
    );
  }

  return <React.Fragment {...rest}>{children}</React.Fragment>;
};
