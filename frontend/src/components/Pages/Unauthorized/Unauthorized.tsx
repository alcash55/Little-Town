import { Box, Button, Stack, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useNavigate, useLocation } from 'react-router-dom';
import { darkTheme } from '../../../layout/Theme';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import PageLayout from '../../../layout/PageLayout/PageLayout';

const Unauthorized = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openLogin, user } = useLoginModal();
  const reason = (location.state as { reason?: string })?.reason;
  const isForbidden = reason === 'forbidden';

  return (
    <PageLayout
      title={isForbidden ? 'Access Denied' : 'Login Required'}
      align="center"
      maxWidth={500}
    >
      <Box sx={{ color: darkTheme.palette.text.secondary, fontSize: 64 }}>
        <LockOutlined fontSize="inherit" />
      </Box>
      <Typography variant="body1" sx={{ textAlign: 'center', color: darkTheme.palette.text.secondary }}>
        {isForbidden
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
    </PageLayout>
  );
};

export default Unauthorized;
