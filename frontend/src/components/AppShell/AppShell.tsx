import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useLocation, useMatch, Outlet } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useLoginModal } from '../LoginModal/useLoginModal';
import { useSidebar } from './InternalComponent/SideBar/useSidebar';
import { Bar, SideBar } from './InternalComponent';
import { ImpersonationBannerHost } from './InternalComponent/Impersonation';

export const AppShell = () => {
  const { loading, sidebar } = useSidebar();
  const { user } = useLoginModal();
  const { pathname } = useLocation();
  const recoveryPage = useMatch('/recover') !== null;
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [openSidebar, setOpenSidebar] = useState(false);
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpenSidebar(false);
    content.current?.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: -10000,
          zIndex: theme.zIndex.modal + 1,
          '&:focus': { left: 8, top: 8, p: 1, bgcolor: 'background.paper' },
        }}
      >
        Skip to content
      </Box>
      <Bar openSidebar={openSidebar} setOpenSidebar={setOpenSidebar} mobile={mobile} />
      <ImpersonationBannerHost />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideBar
          loading={loading}
          openSidebar={openSidebar}
          setOpenSidebar={setOpenSidebar}
          sidebarItems={sidebar}
          desktop={!mobile}
          width={mobile ? 'min(90%, 360px)' : 248}
        />
        <Box
          component="main"
          id="main-content"
          ref={content}
          tabIndex={-1}
          sx={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: 'background.default',
          }}
        >
          {/* Recovery removes the link token from the URL and keeps it in memory.
              Preserve it through session restoration and the reset's sign-out. */}
          <Outlet key={recoveryPage ? 'recovery' : user?.id ?? 'guest'} />
        </Box>
      </Box>
    </Box>
  );
};
