import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../layout/Theme';
import { AppShell } from './AppShell';
import { SidebarProvider } from './InternalComponent/SideBar/useSidebar';
import type { EffectiveRole } from '../../utils/useEffectiveRole';

const state = vi.hoisted(() => {
  const value: {
    user: { id: string; username: string; role: EffectiveRole } | null;
    target: { id: string; label: string; role: EffectiveRole } | null;
    mobile: boolean;
  } = { user: null, target: null, mobile: false };
  return value;
});
vi.mock('../LoginModal/useLoginModal', () => ({
  useLoginModal: () => ({
    user: state.user,
    openLogin: vi.fn(),
    prefetchLoginModal: vi.fn(),
    logout: vi.fn(),
  }),
}));
vi.mock('../Onboarding', () => ({
  useOnboarding: () => ({ canShowIntro: true, showIntro: vi.fn() }),
}));
vi.mock('./InternalComponent/Impersonation/useImpersonationTarget', () => ({
  useImpersonationTarget: () => ({ target: state.target, activate: vi.fn(), clear: vi.fn() }),
}));
vi.mock('./InternalComponent/Impersonation/ImpersonationControl', () => ({
  ImpersonationControl: () => null,
}));
vi.mock('./InternalComponent/Impersonation/ImpersonationBannerHost', () => ({
  ImpersonationBannerHost: () => null,
}));
vi.mock('@mui/material', async (original) => ({
  ...(await original<typeof import('@mui/material')>()),
  useMediaQuery: () => state.mobile,
}));
function App({ path = '/' }: { path?: string }) {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <SidebarProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="*" element={<h1>Page content</h1>} />
            </Route>
          </Routes>
        </SidebarProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
}
beforeEach(() => {
  state.user = null;
  state.target = null;
  state.mobile = false;
});
afterEach(cleanup);
it.each(['public', 'user', 'moderator', 'admin'] as const)(
  'provides one desktop navigation for %s on every page',
  async (role) => {
    if (role !== 'public') state.user = { id: 'member', username: 'Member', role };
    render(<App path={role === 'admin' ? '/AdminPanel/BingoOverview' : '/Resources'} />);
    const nav = await screen.findByRole('navigation', { name: 'Site navigation' });
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(within(nav).getAllByRole('link', { name: 'Home' })).toHaveLength(1);
    expect(within(nav).getByRole('link', { name: 'Resources' })).toBeTruthy();
    expect(within(nav).queryByRole('link', { name: 'Bingo Rules' }) !== null).toBe(
      role !== 'public',
    );
    expect(within(nav).queryByRole('link', { name: 'Bingo Details' }) !== null).toBe(
      role === 'admin',
    );
    if (role === 'admin')
      expect(within(nav).getAllByRole('link', { name: 'Bingo Overview' })).toHaveLength(1);
    expect(screen.queryByRole('complementary', { name: 'Organizer navigation' })).toBeNull();
  },
);
it('removes organizer links when an admin views as a member', async () => {
  state.user = { id: 'admin', username: 'Admin', role: 'admin' };
  const view = render(<App />);
  await screen.findByRole('link', { name: 'Bingo Details' });
  state.target = { id: 'member', label: 'Member', role: 'user' };
  view.rerender(<App />);
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Bingo Details' })).toBeNull());
  expect(screen.getByRole('link', { name: 'Bingo Rules' })).toBeTruthy();
});
it('uses the same sidebar as a mobile drawer and closes it after navigation', async () => {
  state.mobile = true;
  render(<App />);
  expect(screen.queryByRole('navigation')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
  const nav = await screen.findByRole('navigation', { name: 'Site navigation' });
  expect(screen.getAllByRole('navigation')).toHaveLength(1);
  fireEvent.click(within(nav).getByRole('link', { name: 'Resources' }));
  await waitFor(() => expect(screen.queryByRole('navigation')).toBeNull());
  expect(screen.getByRole('heading', { name: 'Page content' })).toBeTruthy();
});
