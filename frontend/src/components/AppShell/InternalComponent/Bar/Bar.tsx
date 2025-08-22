import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  Avatar,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import { Menu as MenuIcon, Login, Logout, Person } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { darkTheme } from '../../../../layout/Theme';
import { useLoginModal } from '../../../../components/LoginModal/useLoginModal';

interface Props {
  openSidebar: boolean;
  setOpenSidebar: (value: boolean) => void;
}

const Bar = ({ openSidebar, setOpenSidebar }: Props) => {
  const toggleSidebar = () => {
    setOpenSidebar(!openSidebar);
  };

  const navigate = useNavigate();
  const { openLogin, prefetchLoginModal, user, logout } = useLoginModal();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ bgcolor: darkTheme.palette.secondary.main }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" gap={2}>
            <IconButton
              aria-label="Toggle Sidebar"
              size="large"
              onClick={toggleSidebar}
              sx={{
                color: 'white',
                '&:hover': {
                  bgcolor: '#163a36',
                },
              }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              onClick={() => navigate('/')}
              component={'a'}
              variant="h1"
              tabIndex={0}
              sx={{
                '&:hover': {
                  transform: 'scale(1.1)',
                  animationName: 'hover',
                },
                width: '100px',
                height: '44px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              noWrap
              fontSize={18}
            >
              Little Town
            </Typography>
          </Box>

          {user ? (
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="white" sx={{ mr: 1 }}>
                {user.username}
              </Typography>
              <IconButton
                size="large"
                aria-label="User menu"
                onClick={handleMenuOpen}
                sx={{
                  color: 'white',
                  '&:hover': {
                    bgcolor: '#163a36',
                  },
                }}
              >
                <Person />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                  sx: {
                    bgcolor: darkTheme.palette.secondary.main,
                    border: `1px solid ${darkTheme.palette.primary.main}`,
                    color: 'white',
                  },
                }}
              >
                <MenuItem onClick={handleMenuClose}>
                  <Typography variant="body2">Role: {user.role}</Typography>
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <Logout sx={{ mr: 1 }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <IconButton
              size="large"
              aria-label="Login"
              onClick={openLogin}
              onMouseEnter={prefetchLoginModal}
              sx={{
                color: 'white',
                '&:hover': {
                  bgcolor: '#163a36',
                },
              }}
            >
              <Login />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>
    </Box>
  );
};

export default Bar;
