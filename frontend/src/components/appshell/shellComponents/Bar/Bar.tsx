import { AppBar, IconButton, Typography, Box } from '@mui/material';
import { Menu } from '@mui/icons-material';
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
    <AppBar
      sx={{
        bgcolor: darkTheme.palette.secondary.main,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexGrow: 1,
        height: '50px',
        pr: 4,
        pl: 3,
      }}
    >
      <IconButton aria-label="Toggle Sidebar" onClick={toggleSidebar} sx={{ color: 'white' }}>
        <Menu />
      </IconButton>

      <Box>
        <Typography
          onClick={() => navigate('/')}
          component={'div'}
          variant="h1"
          sx={{
            '&:hover': { cursor: 'pointer' },
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
    </AppBar>
  );
};

export default Bar;
