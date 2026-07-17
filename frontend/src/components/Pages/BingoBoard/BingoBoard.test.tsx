import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../../layout/Theme';
import BingoBoard from './BingoBoard';

// No `globals: true` in vitest.config.ts — see BingoTile.test.tsx for why
// this manual afterEach(cleanup) is required.
afterEach(() => cleanup());

vi.mock('../../../utils/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../../../utils/fetchWithAuth';

const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const renderBoard = () =>
  render(
    <ThemeProvider>
      <BingoBoard />
    </ThemeProvider>,
  );

beforeEach(() => {
  mockedFetchWithAuth.mockReset();
});

// TEAM-BRIEF.md Sprint 15, Track A item 4 (frozen contract) / Track B item
// 3: GET /api/bingo/board additively returns `{ active: false, ended: {
// name, endDate } }` once the most recent bingo is complete — the public
// board must render this as a distinct "has ended" state, not the generic
// "no active bingo" copy, and without leaking any team data.
describe('BingoBoard — ended state (TEAM-BRIEF.md Sprint 15)', () => {
  it('renders the ended state with the bingo name and end date, not the generic "no active bingo" copy', async () => {
    mockedFetchWithAuth.mockResolvedValue(
      jsonResponse({ active: false, ended: { name: 'Summer Bingo', endDate: '2026-06-30T12:00:00.000Z' } }),
    );

    renderBoard();

    expect(await screen.findByText(/summer bingo has ended/i)).toBeTruthy();
    expect(screen.queryByText(/no active bingo/i)).toBeNull();
  });

  it('still renders the generic "no active bingo" copy when `ended` is absent (no bingo has ever run)', async () => {
    mockedFetchWithAuth.mockResolvedValue(jsonResponse({ active: false }));

    renderBoard();

    expect(await screen.findByText(/no active bingo/i)).toBeTruthy();
    expect(screen.queryByText(/has ended/i)).toBeNull();
  });
});
