import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

export function AccountRecoveryAdmin() {
  const [username, setUsername] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setUrl('');
    try {
      const response = await fetchWithAuth(
        `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/admin/users/recovery`,
        {
          method: 'POST',
          body: JSON.stringify({ username, confirm: confirmed }),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? 'Sign in as a real admin to issue recovery links.'
            : response.status === 429
            ? 'Too many links. Try again in 15 minutes.'
            : 'Could not issue a link. Check the username. Accounts with email must use email recovery.',
        );
      if (
        !result ||
        typeof result !== 'object' ||
        !('data' in result) ||
        !result.data ||
        typeof result.data !== 'object' ||
        !('url' in result.data) ||
        typeof result.data.url !== 'string'
      )
        throw new Error('Unexpected response.');
      setUrl(result.data.url);
      setConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not issue a link.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack component="form" spacing={2} onSubmit={submit}>
      <Typography variant="h5" component="h2">
        Recover an account without email
      </Typography>
      <Typography>
        Verify the member's identity through your established clan contact before issuing a link.
        Share it privately with that member only. A new link replaces any previous link and expires
        in one hour.
      </Typography>
      <TextField
        label="Account username"
        required
        value={username}
        disabled={busy}
        onChange={(event) => {
          setUsername(event.target.value);
          setConfirmed(false);
          setUrl('');
        }}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={confirmed}
            disabled={busy}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
        }
        label="I verified this member's identity and intend to issue a recovery link."
      />
      <Button type="submit" disabled={!confirmed || busy || !username.trim()} variant="outlined">
        {busy ? 'Issuing link...' : 'Issue single-use recovery link'}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {url && (
        <>
          <Alert severity="warning">
            Copy this link now. It will not be shown again after leaving this page.
          </Alert>
          <TextField
            label="Private recovery link"
            value={url}
            slotProps={{ input: { readOnly: true } }}
            onFocus={(event) => event.target.select()}
          />
          <Button onClick={() => setUrl('')}>Dismiss private link</Button>
        </>
      )}
    </Stack>
  );
}
