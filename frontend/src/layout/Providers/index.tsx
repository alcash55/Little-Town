import { Suspense } from 'react';
import { ThemeProvider } from '../Theme';
import { SidebarProvider } from '../../components/AppShell/InternalComponent/SideBar/useSidebar';
import { AppShell } from '../../components/AppShell/AppShell';
import { LoadingContainer } from '../../components/LoadingContainer/LoadingContainer';
import { LoginModalProvider } from '../../components/LoginModal/useLoginModal';
import { OnboardingProvider } from '../../components/Onboarding';

// `@mui/x-date-pickers` (+ its date-fns adapter) is intentionally NOT provided
// here. It's only consumed by the admin-only BingoDetails route, which is
// already React.lazy-split — wrapping every route in LocalizationProvider
// would pull that vendor weight into the chunk every visitor downloads on
// first paint. BingoDetails supplies its own LocalizationProvider locally.
export function Providers() {
  return (
    <Suspense fallback={<LoadingContainer loading={true} width={250} height={250} />}>
      <ThemeProvider>
        <LoginModalProvider>
          <OnboardingProvider>
            <SidebarProvider>
              <AppShell />
            </SidebarProvider>
          </OnboardingProvider>
        </LoginModalProvider>
      </ThemeProvider>
    </Suspense>
  );
}
