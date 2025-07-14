import { Suspense } from 'react';
import { ThemeProvider } from '../Theme';
import { SidebarProvider } from '../../components/AppShell/InternalComponent/SideBar/useSidebar';
import { AppShell } from '../../components/AppShell/AppShell';
import { LoadingContainer } from '../../components/LoadingContainer/LoadingContainer';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';

export function Providers() {
  return (
    <Suspense fallback={<LoadingContainer loading={true} width={250} height={250} />}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <ThemeProvider>
          <SidebarProvider>
            <AppShell />
          </SidebarProvider>
        </ThemeProvider>
      </LocalizationProvider>
    </Suspense>
  );
}
