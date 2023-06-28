import { Box, Typography } from '@mui/material';

const Error = () => {
  return (
    <Box
      sx={{
        bgcolor: '#424242',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Typography variant="h1">404</Typography>
    </Box>
  );
};

export default Error;
