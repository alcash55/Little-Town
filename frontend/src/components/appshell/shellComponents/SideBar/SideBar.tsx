import { useEffect, useState } from 'react';
import { Close, Home, Looks, BarChart, EmojiEvents, Gavel, Casino } from '@mui/icons-material';
import Discord from '../../../../assets/Images/Discord';
import BoardGame from '../../../../assets/Images/BoardGame';
import { Box, Button, Divider, Drawer, IconButton, Toolbar, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { SidebarItem } from '../../../../contexts';
import { darkTheme } from '../../../../layout/Theme';
import { LoadingContainer } from '../../../LoadingContainer/LoadingContainer';

interface Props {
  loading: boolean;
  openSidebar: boolean;
  setOpenSidebar: (value: boolean) => void;
  sidebarItems: SidebarItem[];
  width: string | number;
}

const Sidebar = ({ loading, openSidebar, setOpenSidebar, sidebarItems, width }: Props) => {
  const [drawerWidth, setDrawerWidth] = useState(width);
  const closeSideBar = () => {
    setOpenSidebar(false);
  };

  useEffect(() => {
    setDrawerWidth(width);
  }, [window.innerWidth]);

  const SideBarTopItem = () => {
    return (
      <>
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant={'h1'} fontSize={24} sx={{ color: 'white' }}>
            Little Town
          </Typography>
          <IconButton onClick={closeSideBar} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Toolbar>
        <Divider sx={{ bgcolor: 'white' }} />
      </>
    );
  };

  const SideBarItems = () => {
    return (
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 2,
        }}
      >
        {sidebarItems.map((item: SidebarItem) => {
          let IconComponent;

          switch (item.icon) {
            case 'BarChart':
              IconComponent = BarChart;
              break;
            case 'Home':
              IconComponent = Home;
              break;
            case 'Discord':
              IconComponent = Discord;
              break;
            case 'BoardGame':
              IconComponent = BoardGame;
              break;
            case 'EmojiEvents':
              IconComponent = EmojiEvents;
              break;
            case 'Gavel':
              IconComponent = Gavel;
              break;
            case 'Casino':
              IconComponent = Casino;
              break;
            default:
              IconComponent = Looks; // Set a default icon component
          }
          return (
            <Button
              startIcon={<IconComponent />} // Render the icon component
              component={Link}
              to={`${item.href}`}
              target={item.href.includes('discord') ? '_blank' : ''}
              color="inherit"
              sx={{
                my: 1,
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                color: 'white',
              }}
              key={item.title}
            >
              <Typography>{item.title}</Typography>
            </Button>
          );
        })}
      </Box>
    );
  };

  return (
    <Drawer
      anchor={'left'}
      open={openSidebar}
      onClose={closeSideBar}
      PaperProps={{
        sx: {
          width: drawerWidth,
          overflowX: 'hidden',
          overflowY: 'hidden',
          bgcolor: darkTheme.palette.secondary.main,
        },
      }}
    >
      <Box sx={{ width: '100%', height: '100%', px: 1 }}>
        <SideBarTopItem />
        <LoadingContainer loading={loading} width={100} height={100}>
          <SideBarItems />
        </LoadingContainer>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
