import { Stack, Typography } from '@mui/material';
import { darkTheme } from '../../../../layout/Theme';

const ScreenshotSubmission = () => {
  return (
    <Stack
      spacing={3}
      height={'100%'}
      width={'100%'}
      justifyContent={'center'}
      alignItems={'center'}
      sx={{ bgcolor: darkTheme.palette.primary.main, p: 5 }}
    >
      <Typography variant="h1" sx={{ fontSize: 42, textAlign: 'center' }}>
        Screenshot Submission
      </Typography>
    </Stack>
  );
};

export default ScreenshotSubmission;
