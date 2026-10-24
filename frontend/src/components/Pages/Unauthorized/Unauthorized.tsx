import { useEffect, useRef } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useNavigate, useLocation } from 'react-router-dom';
import { darkTheme } from '../../../layout/Theme';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import { useEffectiveRole } from '../../../utils/useEffectiveRole';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { LoadingContainer } from '../../LoadingContainer/LoadingContainer';

const Unauthorized = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openLogin, user, authReady } = useLoginModal();
  const { role: effectiveRole } = useEffectiveRole();
  const from = (location.state as { from?: { pathname?: string } })?.from;
  const isForbidden = Boolean(user);

  // Recheck the denied route after a role change, including clearing an
  // impersonation override. The copy above follows the current session,
  // since the redirect's reason can outlive a cross-tab account switch.
  const previousRoleRef = useRef(effectiveRole);
  useEffect(() => {
    if (!authReady) return;
    const roleChanged = previousRoleRef.current !== effectiveRole;
    previousRoleRef.current = effectiveRole;
    if (roleChanged && from?.pathname) {
      navigate(from.pathname, { replace: true });
    }
  }, [authReady, effectiveRole, from, navigate]);

  // Clearing impersonation reloads this page. Hide the old denial until
  // /me settles and the route can be checked against the restored role.
  if (!authReady) return <LoadingContainer loading width={250} height={250} />;

  return (
    <PageLayout
      title={isForbidden ? 'Access Denied' : 'Login Required'}
      align="center"
      maxWidth={500}
    >
      <Box sx={{ color: darkTheme.palette.text.secondary, fontSize: 64 }}>
        <LockOutlined fontSize="inherit" />
      </Box>
      <Typography
        variant="body1"
        sx={{ textAlign: 'center', color: darkTheme.palette.text.secondary }}
      >
        {isForbidden
          ? "You don't have permission to view this page."
          : 'You need to log in to access this page.'}
      </Typography>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {!user ? (
          <Button variant="outlined" color="success" onClick={openLogin}>
            Log In
          </Button>
        ) : null}
        <Button variant="outlined" color="success" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </Stack>
    </PageLayout>
  );
};

export default Unauthorized;
