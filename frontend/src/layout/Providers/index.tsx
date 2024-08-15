import { Suspense } from 'react';
import { ThemeProvider } from '../Theme';
import { SidebarProvider } from '../../components/AppShell/InternalComponent/SideBar/useSidebar';
import { AppShell } from '../../components/AppShell/AppShell';
import { LoadingContainer } from '../../components/LoadingContainer/LoadingContainer';

export function Providers() {
  return (
    <Suspense
      fallback={
        <LoadingContainer loading={true} width={250} height={250}>
          <></>
        </LoadingContainer>
      }
    >
      <ThemeProvider>
        <SidebarProvider>
          <AppShell />
        </SidebarProvider>
      </ThemeProvider>
    </Suspense>
  );
}
