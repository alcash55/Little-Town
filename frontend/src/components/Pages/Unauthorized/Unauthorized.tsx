import { Box, Button, Stack, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useNavigate, useLocation } from 'react-router-dom';
import { darkTheme } from '../../../layout/Theme';
import { useLoginModal } from '../../LoginModal/useLoginModal';

const Unauthorized = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openLogin, user } = useLoginModal();
  const reason = (location.state as any)?.reason;

  return (
    <Stack
      spacing={3}
      height="100%"
      width="100%"
      justifyContent="center"
      alignItems="center"
      sx={{ bgcolor: darkTheme.palette.primary.main, p: 5 }}
    >
      <Box sx={{ color: darkTheme.palette.text.secondary, fontSize: 64 }}>
        <LockOutlined fontSize="inherit" />
      </Box>
      <Typography variant="h4" sx={{ textAlign: 'center' }}>
        {reason === 'forbidden' ? 'Access Denied' : 'Login Required'}
      </Typography>
      <Typography variant="body1" sx={{ textAlign: 'center', color: darkTheme.palette.text.secondary }}>
        {reason === 'forbidden'
          ? "You don't have permission to view this page."
          : 'You need to log in to access this page.'}
      </Typography>
      <Stack direction="row" spacing={2}>
        {!user && (
          <Button variant="outlined" color="success" onClick={openLogin}>
            Log In
          </Button>
        )}
        <Button variant="outlined" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </Stack>
    </Stack>
  );
};

export default Unauthorized;
