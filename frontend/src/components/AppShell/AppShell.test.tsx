import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../layout/Theme';
import { AppShell } from './AppShell';

const session = vi.hoisted(() => {
  const value: { user: { id: string } | null } = { user: null };
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
