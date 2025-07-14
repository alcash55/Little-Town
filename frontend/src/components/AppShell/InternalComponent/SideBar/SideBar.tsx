import React, { useEffect, useState } from 'react';
import { Close, ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { SidebarItem } from './useSidebar';
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
  /**
   * expand and collapse children
   */
  const [openChilodren, setOpenChildren] = useState(true);

  const closeSideBar = () => {
    setOpenSidebar(false);
  };

  useEffect(() => {
    setDrawerWidth(width);
  }, [window.innerWidth]);

  const buttonStyles = {
    width: '100%',
    color: 'white',
    bgcolor: 'inherit',
    borderRadius: '5px',
    '&:hover': {
      bgcolor: '#163a36',
    },
  };

  /**
   * Title and X button for the sidebar
   */
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
          <IconButton
            onClick={closeSideBar}
            sx={{ color: 'white', '&:hover': { bgcolor: '#163a36' } }}
          >
            <Close />
          </IconButton>
        </Toolbar>
        <Divider sx={{ bgcolor: 'white' }} />
      </>
    );
  };

  /**
   * Sublist of children for each parent item in the sidebar
   */
  const SideBarChildren = (children: SidebarItem[]) => (
    <>
      {children.map((child, idx) => {
        return (
          <React.Fragment key={idx}>
            <ListItemButton
              component={Link}
              to={`${child.href}`}
              color="inherit"
              sx={{ ...buttonStyles }}
            >
              <ListItemIcon sx={{ color: 'white' }}>{child.icon}</ListItemIcon>
              <ListItemText>{child.title}</ListItemText>
            </ListItemButton>
            <Divider sx={{ color: 'white' }} />
          </React.Fragment>
        );
      })}
    </>
  );

  /**
   * List of all the items in the sidebar
   */
  const SideBarItems = () => {
    return (
      <>
        {sidebarItems.map((item: SidebarItem) => {
          return (
            <List
              component={'nav'}
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                p: 0,
              }}
              key={item.title}
            >
              {/* If the item has children, render the children list */}
              {item.children && item.children.length ? (
                <>
                  <ListItemButton
                    onClick={() => setOpenChildren(!openChilodren)}
                    color="inherit"
                    sx={{ ...buttonStyles }}
                  >
                    <ListItemIcon
                      sx={{
                        fill: 'white',
                        color: 'white',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.title} />
                    <ListItemIcon
                      sx={{
                        fill: 'white',
                        color: 'white',
                      }}
                    >
                      {openChilodren ? <ExpandLess /> : <ExpandMore />}
                    </ListItemIcon>
                  </ListItemButton>
                  <Divider sx={{ color: 'white' }} />
                  <Collapse
                    in={openChilodren}
                    timeout="auto"
                    unmountOnExit
                    sx={{ width: '100%', ml: 5 }}
                  >
                    <List
                      component="div"
                      sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        p: 0,
                      }}
                    >
                      {SideBarChildren(item.children)}
                    </List>
                  </Collapse>
                </>
              ) : (
                <>
                  <ListItemButton
                    component={Link}
                    to={`${item.href}`}
                    target={item.href.includes('discord') ? '_blank' : ''}
                    color="inherit"
                    sx={{ ...buttonStyles }}
                  >
                    <ListItemIcon sx={{ fill: 'white', color: 'white' }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.title} />
                  </ListItemButton>
                  <Divider sx={{ color: 'white' }} />
                </>
              )}
            </List>
          );
        })}
      </>
    );
  };

  return (
    <Drawer
      id="sidebar"
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
      <Box sx={{ width: '100%', height: '100%' }}>
        <SideBarTopItem />
        <LoadingContainer loading={loading} width={100} height={100}>
          <SideBarItems />
        </LoadingContainer>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
