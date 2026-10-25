import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../../../layout/Theme';
import { BingoDetails } from './BingoDetails';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
vi.mock('../../../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));
vi.mock('./BingoLifecycle', () => ({ BingoLifecycle: () => null }));
const request = vi.mocked(fetchWithAuth);
const existing = {
  id: 'local-event',
  name: 'Clan bingo',
  status: 'draft',
  startDate: '2099-12-01T20:00:00.000Z',
  endDate: '2099-12-15T20:00:00.000Z',
  boardSize: 16,
  numberOfTeams: 2,
  teams: ['North', 'South'],
  tasks: [],
};
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(
    async (_url, init) =>
      new Response(JSON.stringify({ data: init?.method === 'PUT' ? {} : existing }), {
        status: 200,
      }),
  );
});
afterEach(cleanup);
const open = async () => {
  render(
    <ThemeProvider>
      <BingoDetails />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText(/Bingo name/).getAttribute('value')).toBe('Clan bingo'),
  );
};
describe('event setup flow', () => {
  it('retains dates and team edits across steps, then sends every existing field to the update API', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Bingo name/), {
      target: { value: 'Winter clan bingo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Number of teams/ }));
    fireEvent.click(await screen.findByRole('option', { name: '3 teams' }));
    fireEvent.change(screen.getByLabelText(/Team 3/), { target: { value: 'East' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.getByText('North, South, East')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText(/Team 3/).getAttribute('value')).toBe('East');
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modify Bingo' }));
    await waitFor(() =>
      expect(request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
    );
    const update = request.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      name: 'Winter clan bingo',
      startDate: existing.startDate,
      endDate: existing.endDate,
      boardSize: 16,
      numberOfTeams: 3,
      teams: ['North', 'South', 'East'],
    });
  });
  it('does not let an empty team name advance to review or submit', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.change(screen.getByLabelText(/Team 2/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: /Review & save/ }));
    expect(screen.getByText('Give every team a name before reviewing.')).toBeTruthy();
    expect(request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });
});
