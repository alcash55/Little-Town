import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RsnStep from './RsnStep';
import { useLoginModal, type User } from '../../LoginModal/useLoginModal';
import type { OnboardingProfile } from '../useOnboardingProfile';
import type { RsnConfirmation } from '../useRsnConfirmation';

// Issue #49: RsnStep's Autocomplete was never unit-tested. happy-dom (this
// repo's vitest environment, see vitest.config.ts) ships its own
// ResizeObserver, so no polyfill is needed here the way it would be under
// plain jsdom.
vi.mock('../../LoginModal/useLoginModal', async () => {
  const actual = await vi.importActual<typeof import('../../LoginModal/useLoginModal')>(
    '../../LoginModal/useLoginModal',
  );
  return { ...actual, useLoginModal: vi.fn() };
});

const mockedUseLoginModal = vi.mocked(useLoginModal);

const asLoginModal = (user: User | null): ReturnType<typeof useLoginModal> => ({
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
  authReady: true,
});

function makeProfile(overrides: Partial<OnboardingProfile> = {}): OnboardingProfile {
  return {
    loading: false,
    error: null,
    teamId: 'team-1',
    teamName: 'Team One',
    rsns: ['Lynx_Titan', 'Zezima'],
    settled: true,
    ...overrides,
  };
}

function makeRsn(overrides: Partial<RsnConfirmation> = {}): RsnConfirmation {
  return {
    selected: null,
    status: 'idle',
    failures: 0,
    alreadyTracked: false,
    confirmed: false,
    commit: vi.fn(),
    retry: vi.fn(),
    softPass: vi.fn(),
    ...overrides,
  };
}

function renderStep(profile: OnboardingProfile, rsn: RsnConfirmation) {
  return render(
    <MemoryRouter>
      <RsnStep profile={profile} rsn={rsn} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedUseLoginModal.mockReturnValue(asLoginModal(null));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RsnStep (issue #49)', () => {
  it('mounts the Autocomplete and lists roster suggestions as options', () => {
    renderStep(makeProfile(), makeRsn());

    expect(screen.getByLabelText(/your rsn/i)).not.toBeNull();
  });

  it('shows the loading spinner instead of the input while the roster fetch is in flight', () => {
    renderStep(makeProfile({ loading: true }), makeRsn());

    expect(screen.queryByLabelText(/your rsn/i)).toBeNull();
  });

  it('commits the typed value on blur (freeSolo autoSelect)', () => {
    const commit = vi.fn();
    renderStep(makeProfile(), makeRsn({ commit }));

    const input = screen.getByLabelText(/your rsn/i);
    fireEvent.change(input, { target: { value: 'B0aty' } });
    fireEvent.blur(input);

    expect(commit).toHaveBeenCalledWith('B0aty');
  });

  it('shows the invalid-RSN alert for status: invalid', () => {
    renderStep(makeProfile(), makeRsn({ selected: 'Nonexistent', status: 'invalid' }));

    expect(screen.getByText(/wasn't found on the osrs hiscores/i)).not.toBeNull();
  });

  it('shows the taken-RSN alert for status: taken', () => {
    renderStep(makeProfile(), makeRsn({ selected: 'Zezima', status: 'taken' }));

    expect(screen.getByText(/already claimed by a different account/i)).not.toBeNull();
  });

  it('offers retry and, after enough failures, a soft-pass button when the claim service is down', () => {
    renderStep(makeProfile(), makeRsn({ selected: 'Zezima', status: 'down', failures: 2 }));

    expect(screen.getByRole('button', { name: /retry/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /continue without verifying/i })).not.toBeNull();
  });
});
