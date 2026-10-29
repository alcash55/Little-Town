import { Box } from '@mui/material';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router-dom';
import { ThemeProvider } from '../../layout/Theme';
import { RouteFailure } from '../RouteFailure/RouteFailure';

// Keep this eager and independent of auth/onboarding: their providers or
// a lazy module may be the part that failed.
export function RouteErrorBoundary() {
  const error: unknown = useRouteError();
  const { pathname } = useLocation();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return (
    <ThemeProvider>
      <Box component="main" sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center' }}>
        {missing ? (
          <RouteFailure kind="not-found" />
        ) : (
          <RouteFailure kind="unavailable" recovery={pathname === '/recover'} />
        )}
      </Box>
    </ThemeProvider>
  );
}
