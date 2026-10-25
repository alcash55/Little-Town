import { Box, Button, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useLocation, Outlet, NavLink } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useSidebar } from './InternalComponent/SideBar/useSidebar';
import { Bar, SideBar } from './InternalComponent';
import { ImpersonationBannerHost } from './InternalComponent/Impersonation';

export const AppShell = () => {
  const { loading, sidebar } = useSidebar();
  const { pathname } = useLocation();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [openSidebar, setOpenSidebar] = useState(false);
  const content = useRef<HTMLElement>(null);
  const organizerItems = sidebar.find((item) => item.children)?.children;
  const organizerPage = pathname.startsWith('/AdminPanel/');
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
      <Bar openSidebar={openSidebar} setOpenSidebar={setOpenSidebar} />
      <ImpersonationBannerHost />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {organizerPage && organizerItems && (
          <Box
            component="aside"
            aria-label="Organizer navigation"
            sx={{
              display: { xs: 'none', md: 'block' },
              width: 216,
              flexShrink: 0,
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              p: 2,
              overflowY: 'auto',
            }}
          >
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', px: 1, mb: 2 }}
            >
              Organizer workspace
            </Typography>
            {organizerItems.map((item) => (
              <Button
                key={item.href}
                component={NavLink}
                to={item.href}
                fullWidth
                sx={{
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  fontSize: 12,
                  color: 'text.secondary',
                  my: 0.25,
                  '&.active': { color: 'primary.main', bgcolor: 'action.selected' },
                }}
              >
                {item.title}
              </Button>
            ))}
            <Button component={NavLink} to="/BingoBoard" sx={{ mt: 3 }}>
              ← Player view
            </Button>
          </Box>
        )}
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
          <Outlet />
        </Box>
      </Box>
      <SideBar
        loading={loading}
        openSidebar={openSidebar}
        setOpenSidebar={setOpenSidebar}
        sidebarItems={sidebar}
        width={mobile ? 'min(90%, 360px)' : 300}
      />
    </Box>
  );
};
