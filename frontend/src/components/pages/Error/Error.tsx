import { Box, Button, Typography } from '@mui/material';

const Error = () => {
  return (
    <Box
      sx={{
        bgcolor: '#424242',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <Typography variant="h1">404 - Page Not Found</Typography>
      <Button size="large" variant="contained" href="/">
        Go Home
      </Button>
    </Box>
  );
};

export default Error;
