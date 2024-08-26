import { AppBar, Box, IconButton, Toolbar, Typography, Avatar, Button } from '@mui/material';
import { Menu, Login } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { darkTheme } from '../../../../layout/Theme';

interface Props {
  openSidebar: boolean;
  setOpenSidebar: (value: boolean) => void;
}

const Bar = ({ openSidebar, setOpenSidebar }: Props) => {
  const toggleSidebar = () => {
    setOpenSidebar(!openSidebar);
  };

  const navigate = useNavigate();

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
              <Menu />
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
          <IconButton
            size="large"
            aria-label="Login"
            // onClick={}
            sx={{
              color: 'white',
              '&:hover': {
                bgcolor: '#163a36',
              },
            }}
          >
            <Login />
          </IconButton>
        </Toolbar>
      </AppBar>
    </Box>
  );
};

export default Bar;
