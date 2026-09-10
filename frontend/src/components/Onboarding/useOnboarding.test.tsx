import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { OnboardingProvider, useOnboarding } from './useOnboarding';
import { useLoginModal, type User } from '../LoginModal/useLoginModal';

// Isolates this suite from LoginModalProvider's real /me rehydration fetch —
// only `user`/`authReady` matter to OnboardingProvider, so those are the
// only two fields varied per test.
vi.mock('../LoginModal/useLoginModal', async () => {
  const actual = await vi.importActual<typeof import('../LoginModal/useLoginModal')>(
    '../LoginModal/useLoginModal',
  );
  return { ...actual, useLoginModal: vi.fn() };
});

// The real OnboardingWizard pulls in useOnboardingProfile/useRsnConfirmation,
// which hit the network — irrelevant to the open/closed gating this suite
// covers, so it's replaced with a lightweight stub (same convention as
// mocking fetchWithAuth in the sibling onboarding hook tests).
vi.mock('./OnboardingWizard', () => ({
  default: () => <div data-testid="onboarding-wizard-stub" />,
}));

const mockedUseLoginModal = vi.mocked(useLoginModal);

const asLoginModal = (user: User | null, authReady: boolean): ReturnType<typeof useLoginModal> => ({
  openLogin: () => {},
  closeLogin: () => {},
  prefetchLoginModal: () => {},
  isOpen: false,
  isSubmitting: false,
  errorMessage: null,
  loginWithCredentials: async () => {},
  completeSession: () => {},
  user,
  logout: () => {},
  authReady,
});

const ADMIN: User = {
  id: 'admin-1',
  username: 'admin',
  role: 'admin',
  createdAt: '',
  updatedAt: '',
};

function OpenStateProbe() {
  const { open } = useOnboarding();
  return <div data-testid="open-state">{String(open)}</div>;
}

function NavigateButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>{`go-${to}`}</button>;
}

const renderAt = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <OnboardingProvider>
        <OpenStateProbe />
        <NavigateButton to="/" />
        <NavigateButton to="/AdminPanel/BoardBuilder" />
      </OnboardingProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  // No global RTL cleanup wired into vitest.config.ts (see BingoBoard.test.tsx
  // for precedent) — without this, each test's rendered tree piles up in
  // document.body and later `screen.getBy*` queries match multiple elements.
  cleanup();
  vi.restoreAllMocks();
});

// Regression coverage for B6 (TEAM-BRIEF.md Sprint 17, Track B1 #4): the
// auto-open wizard used to fire on ANY route for any signed-in user with no
// onboarding record, including /AdminPanel/* — where it's non-dismissable
// and blocks the page underneath entirely. See useOnboarding.tsx's B6
// comment for the route-vs-role rationale.
describe('OnboardingProvider — B6 admin-trap fix (bug-report investigation)', () => {
  it('does not auto-open for a first-time admin landing directly on an /AdminPanel/* route', () => {
    mockedUseLoginModal.mockReturnValue(asLoginModal(ADMIN, true));

    renderAt('/AdminPanel/BoardBuilder');

    expect(screen.getByTestId('open-state').textContent).toBe('false');
    expect(screen.queryByTestId('onboarding-wizard-stub')).toBeNull();
  });

  it('still auto-opens for a first-time admin once they navigate to a non-admin route in the same session', () => {
    mockedUseLoginModal.mockReturnValue(asLoginModal(ADMIN, true));

    renderAt('/AdminPanel/BoardBuilder');
    expect(screen.getByTestId('open-state').textContent).toBe('false');

    act(() => {
      screen.getByText('go-/').click();
    });

    expect(screen.getByTestId('open-state').textContent).toBe('true');
  });

  it('still auto-opens immediately for a first-time user landing on a non-admin route (unchanged behavior)', () => {
    mockedUseLoginModal.mockReturnValue(asLoginModal(ADMIN, true));

    renderAt('/');

    expect(screen.getByTestId('open-state').textContent).toBe('true');
  });

  it('never re-opens for a user who already completed the wizard, on admin or non-admin routes alike', () => {
    localStorage.setItem(
      `onboarding:v1:${ADMIN.id}`,
      JSON.stringify({ status: 'completed', at: new Date().toISOString() }),
    );
    mockedUseLoginModal.mockReturnValue(asLoginModal(ADMIN, true));

    renderAt('/');
    expect(screen.getByTestId('open-state').textContent).toBe('false');

    act(() => {
      screen.getByText('go-/AdminPanel/BoardBuilder').click();
    });
    expect(screen.getByTestId('open-state').textContent).toBe('false');
  });

  it('does nothing before auth has settled, even on an admin route', () => {
    mockedUseLoginModal.mockReturnValue(asLoginModal(null, false));

    renderAt('/AdminPanel/BoardBuilder');

    expect(screen.getByTestId('open-state').textContent).toBe('false');
  });
});
