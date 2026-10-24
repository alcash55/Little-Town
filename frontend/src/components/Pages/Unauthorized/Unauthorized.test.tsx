import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Unauthorized from './Unauthorized';

const session = vi.hoisted(() => ({
  user: null as { role: 'admin' | 'user' } | null,
  authReady: false,
  role: null as 'admin' | 'user' | null,
}));

vi.mock('../../LoginModal/useLoginModal', () => ({
  useLoginModal: () => ({ ...session, openLogin: vi.fn() }),
}));
vi.mock('../../../utils/useEffectiveRole', () => ({
  useEffectiveRole: () => ({ role: session.role }),
}));

afterEach(() => {
  cleanup();
  session.user = null;
  session.role = null;
  session.authReady = false;
});

function deniedPage(reason: string, withReturnPath = true) {
  return (
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/unauthorized',
          state: { reason, ...(withReturnPath ? { from: { pathname: '/admin' } } : {}) },
        },
      ]}
    >
      <Routes>
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/admin" element={<div>Rechecked destination</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Unauthorized session transitions', () => {
  it('hides the previous denial while a reload rehydrates the session', () => {
    render(deniedPage('forbidden'));
    expect(screen.queryByText('Access Denied')).toBeNull();
    expect(screen.queryByText('Login Required')).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading Little Town' })).toBeDefined();
  });

  it('uses the current session for cross-tab denial copy, even without a return path', () => {
    session.authReady = true;
    const view = render(deniedPage('unauthenticated', false));
    expect(screen.getByText('Login Required')).toBeDefined();
    session.user = { role: 'user' };
    session.role = 'user';
    view.rerender(deniedPage('unauthenticated', false));
    expect(screen.getByText('Access Denied')).toBeDefined();
    expect(screen.queryByText('Login Required')).toBeNull();
  });

  it('rechecks the denied route after clearing an impersonation override', () => {
    session.authReady = true;
    session.user = { role: 'admin' };
    session.role = 'user';
    const view = render(deniedPage('forbidden'));
    session.role = 'admin';
    view.rerender(deniedPage('forbidden'));
    expect(screen.getByText('Rechecked destination')).toBeDefined();
  });
});
