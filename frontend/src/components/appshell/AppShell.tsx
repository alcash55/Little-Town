import { useTheme, useMediaQuery, Box } from '@mui/material';
import { useLocation, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSidebar } from './InternalComponent/SideBar/useSidebar';
import { Bar, SideBar } from './InternalComponent';

export const AppShell = () => {
  const { loading: loadSidebar, sidebar } = useSidebar();
  const currentLocation = useLocation();

  const theme = useTheme();
  const tempSidebar = useMediaQuery(theme.breakpoints.down(2561));
  const isMobile = useMediaQuery(theme.breakpoints.down(426));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [openSidebar, setOpenSidebar] = useState<boolean>(false);

  useEffect(() => {
    if (tempSidebar) {
      setOpenSidebar(false);
    }
  }, [currentLocation]);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Bar openSidebar={openSidebar} setOpenSidebar={setOpenSidebar} />

      <Outlet />

      <SideBar
        loading={loadSidebar}
        openSidebar={openSidebar}
        setOpenSidebar={setOpenSidebar}
        sidebarItems={sidebar}
        width={isMobile ? '100%' : isTablet ? '50%' : tempSidebar ? 240 : 240}
      />
    </Box>
  );
};

export default AppShell;
