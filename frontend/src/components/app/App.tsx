import React from 'react';
import { Suspense } from 'react';
import { Providers } from '../../layout/Providers';
import { LoadingContainer } from '../LoadingContainer/LoadingContainer';

const Shell = React.lazy(() => import('../appshell/shell/Shell'));

export const App = () => {
  return (
    <Suspense
      fallback={
        <LoadingContainer loading={true} width={300} height={300}>
          <></>
        </LoadingContainer>
      }
    >
      <Providers>
        <Shell />
      </Providers>
    </Suspense>
  );
};
