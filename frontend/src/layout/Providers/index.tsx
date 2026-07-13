import { Suspense } from 'react';
import { ThemeProvider } from '../Theme';
import { SidebarProvider } from '../../components/AppShell/InternalComponent/SideBar/useSidebar';
import { AppShell } from '../../components/AppShell/AppShell';
import { LoadingContainer } from '../../components/LoadingContainer/LoadingContainer';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LoginModalProvider } from '../../components/LoginModal/useLoginModal';
import { OnboardingProvider } from '../../components/Onboarding';

export function Providers() {
  return (
    <Suspense fallback={<LoadingContainer loading={true} width={250} height={250} />}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <ThemeProvider>
          <LoginModalProvider>
            <OnboardingProvider>
              <SidebarProvider>
                <AppShell />
              </SidebarProvider>
            </OnboardingProvider>
          </LoginModalProvider>
        </ThemeProvider>
      </LocalizationProvider>
    </Suspense>
  );
}
