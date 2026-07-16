import { describe, expect, it } from 'vitest';
import { getTileCell } from './helpers';
import type { PlayerRow, TileInfo } from './useTeamData';

// Regression coverage for the bug-report investigation's H3 finding:
// GET /my-team-data used to key `dropStatus` by a LOWERCASED tile task,
// while `tiles[].task` (and therefore `tile.task` passed in here) stays
// real-cased — so a Drops status silently vanished for any task with an
// uppercase letter ("Zulrah", "General Graardor", ...). Fixed at the
// source in backend/src/routes/bingo.ts; this file's old lowercase-fallback
// workaround was removed, so getTileCell now only ever checks the exact
// real-cased key.

const basePlayer: PlayerRow = {
  rsn: 'Zezima',
  playerId: 'player-1',
  teamId: 'team-1',
  teamName: 'Team A',
  isCaptain: false,
  snapshotTakenAt: null,
  skillDeltas: {},
  activityDeltas: {},
  dropStatus: {},
};

const dropsTile: TileInfo = {
  task: 'General Graardor',
  type: 'Drops',
  points: 20,
  target: null,
};

describe('getTileCell — Drops tiles (dropStatus key casing)', () => {
  it('resolves an approved drop keyed by the real-cased task', () => {
    const player: PlayerRow = {
      ...basePlayer,
      dropStatus: { 'General Graardor': 'approved' },
    };
    const cell = getTileCell(dropsTile, player);
    expect(cell.state).toBe('approved');
    expect(cell.label).toBe('Approved');
  });

  it('resolves a pending drop keyed by the real-cased task', () => {
    const player: PlayerRow = {
      ...basePlayer,
      dropStatus: { 'General Graardor': 'pending' },
    };
    const cell = getTileCell(dropsTile, player);
    expect(cell.state).toBe('pending');
  });

  it('a lowercased-only key (the pre-fix backend shape) no longer matches — proves the fallback is gone', () => {
    const player: PlayerRow = {
      ...basePlayer,
      dropStatus: { 'general graardor': 'approved' },
    };
    const cell = getTileCell(dropsTile, player);
    expect(cell.state).toBe('none');
  });

  it('no entry for this task at all -> "none", not a crash', () => {
    const cell = getTileCell(dropsTile, basePlayer);
    expect(cell.state).toBe('none');
    expect(cell.label).toBe('—');
  });

  it('a task with no case-sensitivity concerns (already all-lowercase) still resolves normally', () => {
    const tile: TileInfo = { task: 'zulrah scale', type: 'Drops', points: 10, target: null };
    const player: PlayerRow = { ...basePlayer, dropStatus: { 'zulrah scale': 'approved' } };
    expect(getTileCell(tile, player).state).toBe('approved');
  });
});
