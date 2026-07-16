import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../../layout/Theme';
import { BingoTile } from './BingoTile';

// No `globals: true` in vitest.config.ts, so @testing-library/react's
// auto-cleanup (which relies on detecting a global `afterEach`) doesn't
// register itself — without this, every test's rendered tile/dialog would
// pile up in the DOM across tests in this file, making later `getByText`/
// `getByRole` queries ambiguous or stale.
afterEach(() => cleanup());

// TEAM-BRIEF.md Sprint 13, Track B item 1: the board's yellow "pending
// review" tile treatment, driven by the real `pendingByMyTeam` flag (Track
// A shipped it server-side on GET /api/bingo/board — see routes/bingo.ts).
// These tests exercise BingoTile directly with the flag set by hand rather
// than round-tripping through useBingoBoard/fetch, isolating the
// presentation logic from the network layer.
const renderTile = (props: Partial<React.ComponentProps<typeof BingoTile>> = {}) =>
  render(
    <ThemeProvider>
      <BingoTile
        task="Zulrah kill count"
        completed={false}
        points={20}
        type="Kill Count"
        targetValue={10}
        {...props}
      />
    </ThemeProvider>,
  );

describe('BingoTile pending-review state', () => {
  it('is not surfaced by default (no pendingByMyTeam prop)', () => {
    renderTile();
    const tile = screen.getByRole('button', { name: /zulrah kill count/i });
    expect(tile.getAttribute('aria-label')).not.toMatch(/pending review/i);
  });

  it('renders a "Pending review" cue when pendingByMyTeam is true and the tile is not completed', () => {
    renderTile({ pendingByMyTeam: true });
    const tile = screen.getByRole('button', { name: /pending review for your team/i });
    expect(tile).toBeTruthy();

    // Detail dialog also carries the pending state (brief: "works in the
    // detail dialog too").
    fireEvent.click(tile);
    expect(screen.getByText(/pending review for your team/i)).toBeTruthy();
  });

  it('completed always wins over pendingByMyTeam — never renders both states at once', () => {
    renderTile({ completed: true, pendingByMyTeam: true, myTeamName: 'Iron Foundry' });
    const tile = screen.getByRole('button', { name: /completed by your team/i });
    expect(tile.getAttribute('aria-label')).not.toMatch(/pending review/i);

    fireEvent.click(tile);
    expect(screen.getByText(/completed by iron foundry/i)).toBeTruthy();
    expect(screen.queryByText(/pending review/i)).toBeNull();
  });

  it('pendingByMyTeam does not leak across teams/anonymous callers — false renders as incomplete', () => {
    renderTile({ pendingByMyTeam: false });
    const tile = screen.getByRole('button', { name: /zulrah kill count/i });
    expect(tile.getAttribute('aria-label')).not.toMatch(/pending review/i);
    expect(tile.getAttribute('aria-label')).not.toMatch(/completed/i);
  });
});
