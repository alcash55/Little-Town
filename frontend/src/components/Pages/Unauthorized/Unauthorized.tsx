import { useEffect, useRef } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useNavigate, useLocation } from 'react-router-dom';
import { darkTheme } from '../../../layout/Theme';
import { useLoginModal } from '../../LoginModal/useLoginModal';
import { useEffectiveRole } from '../../../utils/useEffectiveRole';
import PageLayout from '../../../layout/PageLayout/PageLayout';

const Unauthorized = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openLogin, user } = useLoginModal();
  const { role: effectiveRole } = useEffectiveRole();
  const reason = (location.state as { reason?: string })?.reason;
  const from = (location.state as { from?: { pathname?: string } })?.from;
  const isForbidden = reason === 'forbidden';

  // `reason` is a snapshot of `location.state` taken at the redirect that
  // landed here, and it never re-evaluates on its own. That goes stale two
  // ways:
  // - clearing an impersonation override while parked here leaves "Access
  //   Denied" on screen after the admin's real role has already come back;
  // - a cross-tab logout-then-login-as-another-account redirects here as
  //   "Login Required" (user briefly null), then the second tab's new
  //   session rehydrates to a real but still-insufficient role, and the copy
  //   never updates to "Access Denied".
  // Re-sending the visitor through the route they were denied lets
  // ProtectedRoute redo the check against the current effective role on any
  // change, so this page can't outlive the auth state it was rendered for.
  const previousRoleRef = useRef(effectiveRole);
  useEffect(() => {
    const roleChanged = previousRoleRef.current !== effectiveRole;
    previousRoleRef.current = effectiveRole;
    if (roleChanged && from?.pathname) {
      navigate(from.pathname, { replace: true });
    }
  }, [effectiveRole, from, navigate]);

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
