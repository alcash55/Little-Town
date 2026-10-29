import { Alert, Button, Stack, Typography } from '@mui/material';
import { clan } from '../../config/clan';
import PageLayout from '../../layout/PageLayout/PageLayout';

type Props = { kind: 'not-found' } | { kind: 'unavailable'; recovery: boolean };

export function RouteFailure(props: Props) {
  const missing = props.kind === 'not-found';
  return (
    <PageLayout>
      <Typography variant="overline" color="text.secondary">
        {clan.name}
      </Typography>
      <Typography component="h1" variant="h1" sx={{ fontSize: { xs: 30, sm: 38 } }}>
        {missing ? 'Page not found' : "This page couldn't load"}
      </Typography>
      <Typography color="text.secondary">
        {missing
          ? 'This address may be incorrect, or the page may have moved.'
          : 'Refresh to load the latest version, or return home and try again.'}
      </Typography>
      {props.kind === 'unavailable' && props.recovery && (
        <Alert severity="info">
          If you were resetting your password, reopen your original reset link. If you already
          changed it, refresh and log in.
        </Alert>
      )}
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }}>
        {!missing && (
          <Button variant="contained" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        )}
        <Button component="a" href="/" variant={missing ? 'contained' : 'outlined'}>
          Go home
        </Button>
        {missing && (
          <Button component="a" href="/BingoBoard" variant="outlined">
            View bingo board
          </Button>
        )}
      </Stack>
    </PageLayout>
  );
}
