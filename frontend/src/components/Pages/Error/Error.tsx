import { Button } from '@mui/material';
import PageLayout from '../../../layout/PageLayout/PageLayout';

const Error = () => {
  return (
    <PageLayout title="404 - Page Not Found" align="center">
      <Button size="large" variant="contained" href="/">
        Go Home
      </Button>
    </PageLayout>
  );
};

export default Error;
