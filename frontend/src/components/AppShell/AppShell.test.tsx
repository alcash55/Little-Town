import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../layout/Theme';
import { AppShell } from './AppShell';
import { AccountRecovery } from '../Pages/AccountRecovery/AccountRecovery';

const session = vi.hoisted(() => {
  const value: { user: { id: string } | null; authReady: boolean } = {
    user: null,
    authReady: true,
  };
  return value;
});
vi.mock('../LoginModal/useLoginModal', () => ({ useLoginModal: () => session }));
vi.mock('./InternalComponent/SideBar/useSidebar', () => ({
  useSidebar: () => ({ loading: false, sidebar: [] }),
}));
vi.mock('./InternalComponent', () => ({ Bar: () => null, SideBar: () => null }));
vi.mock('./InternalComponent/Impersonation', () => ({ ImpersonationBannerHost: () => null }));

function AccountPage() {
  const [loadedFor, setLoadedFor] = useState('Loading');
  useEffect(() => {
    setLoadedFor(session.user?.id ?? 'Permission denied');
  }, []);
  return <p>{loadedFor}</p>;
}
function App() {
  return (
    <ThemeProvider>
      <MemoryRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<AccountPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}
afterEach(() => {
  cleanup();
  session.user = null;
  session.authReady = true;
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});
describe('page data after an account change', () => {
  it('reloads a page that loaded anonymously when login succeeds without changing the URL', async () => {
    const view = render(<App />);
    expect(await screen.findByText('Permission denied')).toBeTruthy();
    session.user = { id: 'signed-in-account' };
    view.rerender(<App />);
    expect(await screen.findByText('signed-in-account')).toBeTruthy();
    expect(screen.queryByText('Permission denied')).toBeNull();
  });
  it('clears the previous account page when the account changes or logs out', async () => {
    session.user = { id: 'first-account' };
    const view = render(<App />);
    expect(await screen.findByText('first-account')).toBeTruthy();
    session.user = { id: 'second-account' };
    view.rerender(<App />);
    expect(await screen.findByText('second-account')).toBeTruthy();
    session.user = null;
    view.rerender(<App />);
    await waitFor(() => expect(screen.queryByText('second-account')).toBeNull());
    expect(await screen.findByText('Permission denied')).toBeTruthy();
  });
});

it('preserves a recovery link while restoring an existing session', async () => {
  session.authReady = false;
  window.history.replaceState(null, '', '/recover#token=fixture');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ data: { state: 'ready' } }))),
  );
  const page = () => (
    <ThemeProvider>
      <MemoryRouter initialEntries={['/recover']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="recover" element={<AccountRecovery />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
  const view = render(page());
  // The session lookup resolves after the page's first render.
  await new Promise((resolve) => setTimeout(resolve, 0));
  session.user = { id: 'existing-member' };
  session.authReady = true;
  view.rerender(page());
  expect(await screen.findByLabelText(/^New password/)).toBeTruthy();
  expect(screen.queryByLabelText(/^Email/)).toBeNull();
  expect(window.location.hash).toBe('');
});

it('keeps the reset confirmation when the reset signs the member out', async () => {
  session.user = { id: 'existing-member' };
  window.history.replaceState(null, '', '/recover#token=fixture');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(
        async (url: string) =>
          new Response(
            JSON.stringify({ data: { state: url.endsWith('/consume') ? 'complete' : 'ready' } }),
          ),
      ),
  );
  const page = () => (
    <ThemeProvider>
      <MemoryRouter initialEntries={['/recover']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="recover" element={<AccountRecovery />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
  const view = render(page());
  const password = await screen.findByLabelText(/^New password/);
  fireEvent.change(password, { target: { value: 'local reset fixture' } });
  fireEvent.change(screen.getByLabelText(/^Confirm new password/), {
    target: { value: 'local reset fixture' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
  await screen.findByText(/Your password has changed/);
  session.user = null;
  view.rerender(page());
  expect(screen.getByText(/Your password has changed/)).toBeTruthy();
  expect(screen.queryByLabelText(/^Email/)).toBeNull();
});
