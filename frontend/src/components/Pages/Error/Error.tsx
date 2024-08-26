import { Stack, Button, Typography } from '@mui/material';

const Error = () => {
  return (
    <Stack
      component={'section'}
      width={'100%'}
      height={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
      spacing={5}
    >
      <Typography variant="h1">404 - Page Not Found</Typography>
      <Button size="large" variant="contained" href="/">
        Go Home
      </Button>
    </Stack>
  );
};

export default Error;
