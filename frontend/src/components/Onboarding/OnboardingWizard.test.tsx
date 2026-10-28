import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../layout/Theme';
import OnboardingWizard from './OnboardingWizard';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));
vi.mock('../LoginModal/useLoginModal', () => ({
  useLoginModal: () => ({ user: { username: 'member', nickname: 'Member' } }),
}));

const request = vi.mocked(fetchWithAuth);
afterEach(() => {
  cleanup();
  request.mockReset();
});

it('shows the newly linked team in the same tour after connecting an RSN', async () => {
  let linked = false;
  request.mockImplementation(async (url, init) => {
    if (url.endsWith('/onboarding/rsn') && init?.method === 'POST') {
      linked = true;
      return new Response(JSON.stringify({ success: true, data: { rsn: 'Woox', tracked: true } }));
    }
    return new Response(
      JSON.stringify({
        data: {
          teamId: linked ? 'team-alpha' : null,
          teamName: linked ? 'Alpha' : null,
          players: [],
        },
      }),
    );
  });
  render(
    <ThemeProvider>
      <MemoryRouter>
        <OnboardingWizard open dismissable={false} onFinish={vi.fn()} />
      </MemoryRouter>
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(await screen.findByRole('combobox', { name: 'Your RSN' }), {
    target: { value: 'Woox' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find and connect' }));
  await screen.findByText('Your RuneScape name is connected to your account.');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('Alpha')).toBeTruthy();
  expect(screen.queryByText("You're not on a team yet")).toBeNull();
});
