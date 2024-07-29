import { useTheme, useMediaQuery, Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSidebar } from '../../../contexts';
import { Bar, SideBar } from '../shellComponents';
import { AllRoutes } from '../../Routes';

export function Shell() {
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

  const sidebarComponent = sidebar;

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Bar openSidebar={openSidebar} setOpenSidebar={setOpenSidebar} />
      <SideBar
        loading={loadSidebar}
        openSidebar={openSidebar}
        setOpenSidebar={setOpenSidebar}
        sidebarItems={sidebarComponent}
        width={isMobile ? '100%' : isTablet ? '50%' : tempSidebar ? 240 : 240}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <AllRoutes />
      </Box>
    </Box>
  );
}

export default Shell;
