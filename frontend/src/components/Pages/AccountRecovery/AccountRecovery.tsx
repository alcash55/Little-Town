import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import PageLayout from '../../../layout/PageLayout/PageLayout';
import { clearSessionMarker } from '../../../utils/authSession';

const endpoint = `${import.meta.env.VITE_BASEURL || 'http://localhost:8081'}/api/auth/recovery`;
type State =
  | 'request'
  | 'checking'
  | 'confirmation'
  | 'ready'
  | 'expired'
  | 'used'
  | 'invalid'
  | 'complete';

async function callRecovery(action: string, body: object) {
  const response = await fetch(`${endpoint}/${action}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json();
  if (response.status === 429)
    throw new Error('Too many recovery attempts. Try again in 15 minutes.');
  if (
    result &&
    typeof result === 'object' &&
    'data' in result &&
    result.data &&
    typeof result.data === 'object' &&
    'state' in result.data
  ) {
    const state = result.data.state;
    if (
      state === 'ready' ||
      state === 'expired' ||
      state === 'used' ||
      state === 'invalid' ||
      state === 'complete'
    )
      return state;
  }
  if (!response.ok) throw new Error('Recovery is unavailable. Check your input and try again.');
  if (action === 'request') return 'confirmation';
  throw new Error('Recovery is unavailable. Try again.');
}

export function AccountRecovery() {
  // Keep the secret in memory only. Remove it from the address bar immediately.
  // Refreshing this page requires opening the original link again.
  const [link, setLink] = useState(() => ({
    token: new URLSearchParams(window.location.hash.slice(1)).get('token'),
  }));
  const { token } = link;
  const [state, setState] = useState<State>(token ? 'checking' : 'request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const openLink = () => {
      const nextToken = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (!nextToken) return;
      setLink({ token: nextToken });
      setState('checking');
      setError('');
      setPassword('');
      setConfirmation('');
    };
    window.addEventListener('hashchange', openLink);
    return () => window.removeEventListener('hashchange', openLink);
  }, []);

  useEffect(() => {
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (!token) return;
    let active = true;
    callRecovery('status', { token })
      .then((value) => {
        if (active) setState(value);
      })
      .catch(() => {
        if (active) setError('Could not check this link. Reload the original link to try again.');
      });
    return () => {
      active = false;
    };
  }, [link, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (
      state === 'ready' &&
      (password !== confirmation ||
        password.length < 12 ||
        new TextEncoder().encode(password).length > 72)
    ) {
      setError('Passwords must match and use at least 12 characters and at most 72 UTF-8 bytes.');
      return;
    }
    setBusy(true);
    try {
      const value = await callRecovery(
        state === 'ready' ? 'consume' : 'request',
        state === 'ready' ? { token, password } : { email },
      );
      if (value === 'complete') {
        clearSessionMarker();
        setPassword('');
        setConfirmation('');
        // Let the existing auth provider drop any cached user without opening a login modal.
        window.dispatchEvent(new CustomEvent('auth:role-stale'));
      }
      setState(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Recovery is unavailable. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout title="Recover your account" maxWidth={480} contentSx={{ alignItems: 'stretch' }}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        {state === 'checking' && !error && <CircularProgress aria-label="Checking recovery link" />}
        {state === 'confirmation' && (
          <Alert severity="info">
            If an account matches that email, a recovery link will be sent. Check your inbox and
            spam folder. Links expire after one hour. If you have no email on your account, contact
            a clan admin.
          </Alert>
        )}
        {state === 'complete' && (
          <Alert severity="success">
            Your password has changed. All previous sessions have ended. Log in with your new
            password.
          </Alert>
        )}
        {(state === 'expired' || state === 'used' || state === 'invalid') && (
          <>
            <Alert severity="warning">
              {state === 'expired'
                ? 'This recovery link has expired.'
                : state === 'used'
                ? 'This recovery link has already been used.'
                : 'This recovery link is invalid or has been replaced.'}{' '}
              Request a new link, or contact a clan admin if your account has no email.
            </Alert>
            <Button
              onClick={() => {
                setState('request');
                setError('');
              }}
            >
              Request a new link
            </Button>
          </>
        )}
        {(state === 'request' || state === 'ready') && (
          <Stack component="form" spacing={2} onSubmit={submit}>
            {state === 'request' ? (
              <>
                <Typography>
                  Enter your account email. If your account has no email, contact a clan admin for a
                  single-use recovery link.
                </Typography>
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                />
              </>
            ) : (
              <>
                <Typography>
                  Use at least 12 characters and at most 72 UTF-8 bytes. Your other sessions will
                  end when you reset your password.
                </Typography>
                <TextField
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={busy}
                />
              </>
            )}
            <Button type="submit" variant="contained" disabled={busy}>
              {busy
                ? 'Please wait...'
                : state === 'ready'
                ? 'Set new password'
                : 'Send recovery link'}
            </Button>
          </Stack>
        )}
        <Button component={Link} to="/">
          Back to home
        </Button>
      </Stack>
    </PageLayout>
  );
}

export default AccountRecovery;
