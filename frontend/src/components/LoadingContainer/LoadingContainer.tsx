import React, { ReactNode } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import LittleTownAnimation from '../../assets/Images/LittleTownAnimation.gif';
import { clan } from '../../config/clan';
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
        role="status"
        aria-label={`Loading ${clan.name}`}
        aria-busy="true"
        sx={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          minHeight: 160,
          overflow: 'hidden',
          p: 0,
          bgcolor: darkTheme.palette.secondary.main,
        }}
      >
        {clan.loadingAnimation === 'little-town' ? (
          <img
            src={LittleTownAnimation}
            alt="Little Town loading animation"
            height={320}
            width={189}
            style={{ objectFit: 'contain', maxWidth: '100%', width, height }}
          />
        ) : (
          <Stack spacing={2} sx={{ alignItems: 'center', maxWidth: '100%', p: 2 }}>
            <CircularProgress aria-hidden="true" />
            <Typography sx={{ textAlign: 'center' }}>{clan.name}</Typography>
          </Stack>
        )}
      </Box>
    );
  }

  return <React.Fragment {...rest}>{children}</React.Fragment>;
};
