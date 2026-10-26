import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BingoDetails from './BingoDetails';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';

vi.mock('../../../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const fixture = {
  id: 'fixture',
  name: 'Picker regression',
  status: 'draft',
  startDate: '2027-06-10T14:30:00.000Z',
  endDate: '2027-06-20T18:45:00.000Z',
  boardSize: 16,
  numberOfTeams: 2,
  teams: ['Red', 'Blue'],
  tasks: [],
};

describe('event date picker integration', () => {
  it('renders existing dates through the real adapter and preserves them on edit', async () => {
    vi.mocked(fetchWithAuth).mockImplementation(
      async (_url, options) =>
        new Response(JSON.stringify(options?.method ? {} : { data: fixture })),
    );
    render(
      <MemoryRouter>
        <BingoDetails />
      </MemoryRouter>,
    );
    await screen.findByDisplayValue('Picker regression');
    const dates = screen.getAllByRole('group', { name: /^(Start|End)/ });
    expect(dates).toHaveLength(2);
    expect(within(dates[0]).getByRole('spinbutton', { name: 'Day' }).textContent).toBe('10');
    expect(within(dates[1]).getByRole('spinbutton', { name: 'Day' }).textContent).toBe('20');
    for (const group of dates) {
      expect(group.getAttribute('aria-invalid')).not.toBe('true');
      expect(group.querySelector('input')?.required).toBe(true);
    }
    fireEvent.change(screen.getByLabelText(/Bingo Name/), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Modify Bingo' }));
    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('/bingo/fixture'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'Renamed',
            startDate: fixture.startDate,
            endDate: fixture.endDate,
            boardSize: 16,
            numberOfTeams: 2,
            teams: ['Red', 'Blue'],
          }),
        }),
      ),
    );
  });

  it('keeps clone disabled until required dates are entered', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(new Response(JSON.stringify({ data: fixture })));
    render(
      <MemoryRouter>
        <BingoDetails />
      </MemoryRouter>,
    );
    await screen.findByDisplayValue('Picker regression');
    fireEvent.click(screen.getByRole('button', { name: /Clone Board/i }));
    const clone = await screen.findByRole('button', { name: /^Clone$/ });
    expect(clone.hasAttribute('disabled')).toBe(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('input[required]')).toHaveLength(3);
  });

  it('keeps creation disabled with empty required dates', async () => {
    vi.mocked(fetchWithAuth).mockImplementation(async () => new Response('{}', { status: 404 }));
    render(
      <MemoryRouter>
        <BingoDetails />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Add Bingo Details' }).hasAttribute('disabled')).toBe(
      true,
    );
    for (const group of screen.getAllByRole('group', { name: /^(Start|End)/ })) {
      expect(group.querySelector('input')?.required).toBe(true);
    }
  });
});
