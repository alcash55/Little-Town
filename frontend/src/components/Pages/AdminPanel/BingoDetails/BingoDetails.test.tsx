import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../../layout/Theme';
import { BingoDetails } from './BingoDetails';
import { fetchWithAuth } from '../../../../utils/fetchWithAuth';
vi.mock('../../../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));
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
      <MemoryRouter>
        <BingoDetails />
      </MemoryRouter>
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

describe('event setup audit regressions', () => {
  it('submits only the displayed teams after reducing the team count', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Number of teams/ }));
    fireEvent.click(await screen.findByRole('option', { name: '3 teams' }));
    fireEvent.change(screen.getByLabelText(/Team 3/), { target: { value: 'Hidden team' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Number of teams/ }));
    fireEvent.click(await screen.findByRole('option', { name: '2 teams' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.queryByText('North, South, Hidden team')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Modify Bingo' }));
    await waitFor(() =>
      expect(request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
    );
    const update = request.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(update?.[1]?.body)).teams).toEqual(['North', 'South']);
  });
  it('rejects duplicate team names before review, including case and whitespace differences', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.change(screen.getByLabelText(/Team 2/), { target: { value: ' north ' } });
    fireEvent.click(screen.getByRole('tab', { name: /Review & save/ }));
    expect(screen.getByText('Each team needs a different name.')).toBeTruthy();
    expect(request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });
});

describe('board format labels', () => {
  it('describes the existing 35-tile format accurately and preserves its saved value', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Board size' }));
    fireEvent.click(await screen.findByRole('option', { name: '35 tiles' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.getByText('35 tiles')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Modify Bingo' }));
    await waitFor(() =>
      expect(request.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
    );
    const update = request.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(update?.[1]?.body)).boardSize).toBe(35);
  });
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
      <ThemeProvider>
        <MemoryRouter>
          <BingoDetails />
        </MemoryRouter>
      </ThemeProvider>,
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
    fireEvent.change(screen.getByLabelText(/Bingo name/), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
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
      <ThemeProvider>
        <MemoryRouter>
          <BingoDetails />
        </MemoryRouter>
      </ThemeProvider>,
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
      <ThemeProvider>
        <MemoryRouter>
          <BingoDetails />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(
      screen.getByText('Enter a bingo name and choose an end date after the start.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Bingo Details' })).toBeNull();
    for (const group of screen.getAllByRole('group', { name: /^(Start|End)/ })) {
      expect(group.querySelector('input')?.required).toBe(true);
    }
  });
});
