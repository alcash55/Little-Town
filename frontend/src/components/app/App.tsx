import React from 'react';
import { Suspense } from 'react';
import { CircularProgress } from '@mui/material';
import { Providers } from '../../layout/Providers';

const Shell = React.lazy(() => import('../appshell/shell/Shell'));

export const App = () => {
  return (
    <Suspense fallback={<CircularProgress color="success" />}>
      <Providers>
        <Shell />
      </Providers>
    </Suspense>
  );
};
