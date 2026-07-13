import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Login from '@mui/icons-material/Login';
import Logout from '@mui/icons-material/Logout';

import { useNavigate } from 'react-router-dom';
import { lazy, Suspense, useState } from 'react';
import { darkTheme } from '../../../../layout/Theme';
import { useLoginModal } from '../../../../components/LoginModal/useLoginModal';
import { useImpersonationTarget } from '../Impersonation';

// Lazy: pulls in @mui/material's Autocomplete, which only ever renders for
// admins (gated below). Splitting it out keeps Autocomplete's weight out of
// the app shell chunk every visitor downloads on first paint.
const ImpersonationControl = lazy(() =>
  import('../Impersonation/ImpersonationControl').then((m) => ({
    default: m.ImpersonationControl,
  })),
);

const getInitials = (nickname?: string | null, username?: string): string => {
  const source = nickname?.trim() || username?.trim() || '?';
  const words = source.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

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
  const {
    target: impersonationTarget,
    activate: activateImpersonation,
    clear: clearImpersonation,
  } = useImpersonationTarget();
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
          <Box
            sx={{
              display: 'flex',
              gap: 2,
            }}
          >
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
              noWrap
              sx={{
                fontSize: 18,

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
            >
              Little Town
            </Typography>
          </Box>

          {user ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              {user.role === 'admin' && (
                // fallback={null}: this is a single icon button in a fixed-size
                // toolbar slot, not a page — a skeleton would just be layout
                // noise for the split-second the chunk takes to load.
                <Suspense fallback={null}>
                  <ImpersonationControl
                    activeTarget={impersonationTarget}
                    onActivate={activateImpersonation}
                    onClear={clearImpersonation}
                  />
                </Suspense>
              )}
              <IconButton
                size="large"
                aria-label="User menu"
                onClick={handleMenuOpen}
                sx={{ p: 0.5, '&:hover': { bgcolor: '#163a36' } }}
              >
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    fontSize: 13,
                    fontWeight: 700,
                    bgcolor: '#2A9D8F',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  {getInitials(user.nickname, user.username)}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                slotProps={{
                  paper: {
                    sx: {
                      bgcolor: darkTheme.palette.secondary.main,
                      border: `1px solid ${darkTheme.palette.primary.main}`,
                      color: 'white',
                    },
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
