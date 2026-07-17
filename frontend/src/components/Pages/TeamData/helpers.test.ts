import { describe, expect, it } from 'vitest';
import { getTileCell, normalizeTaskText } from './helpers';
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

// D1 regression coverage (TEAM-BRIEF.md Sprint 14 — the actual bug report:
// "board shows 3 completed tiles ... TeamData shows zero progress for every
// player"). bingo_board_tiles.task is stored lowercase ("hitpoints"), while
// GET /my-team-data's skillDeltas/activityDeltas used to be keyed by the raw
// OSRS hiscores API name, which is real-cased ("Hitpoints"). A bare
// `player.skillDeltas[tile.task]` lookup therefore missed on casing for
// EVERY KC/XP tile, regardless of real gains. Fixed by having both the
// backend (backend/src/routes/bingo.ts) and getTileCell key/look up by
// normalizeTaskText — this suite pins the exact prod repro shape plus the
// shared normalizer contract itself.
describe('normalizeTaskText', () => {
  it('mirrors backend/src/services/completionEngine.ts\'s normalizeTaskText exactly: trim, lowercase, collapse whitespace', () => {
    expect(normalizeTaskText('Hitpoints')).toBe('hitpoints');
    expect(normalizeTaskText('  General   Graardor  ')).toBe('general graardor');
  });

  it('is idempotent — normalizing an already-normalized string is a no-op', () => {
    const once = normalizeTaskText('Tombs of Amascut');
    expect(normalizeTaskText(once)).toBe(once);
  });
});

describe('getTileCell — Experience/Kill Count tiles (skillDeltas/activityDeltas key casing, D1)', () => {
  it('EXACT PROD REPRO: lowercase tile.task "hitpoints" resolves against a canonical-cased "Hitpoints" delta key', () => {
    const tile: TileInfo = { task: 'hitpoints', type: 'Experience', points: 10, target: 20 };
    const player: PlayerRow = {
      ...basePlayer,
      // Matches the real hiscore API's canonical casing, and what
      // GET /my-team-data now emits after the D1 fix (normalizeTaskText'd
      // to the same "hitpoints" form as tile.task).
      skillDeltas: { hitpoints: 500_215 },
    };
    const cell = getTileCell(tile, player);
    expect(cell.state).toBe('complete');
    expect(cell.label).toContain('xp');
  });

  it('a Kill Count tile resolves the same way for activityDeltas', () => {
    const tile: TileInfo = { task: 'general graardor', type: 'Kill Count', points: 20, target: 5 };
    const player: PlayerRow = { ...basePlayer, activityDeltas: { 'general graardor': 12 } };
    const cell = getTileCell(tile, player);
    expect(cell.state).toBe('complete');
    expect(cell.label).toContain('kc');
  });

  it('in-progress (below target) still resolves via the normalized key', () => {
    const tile: TileInfo = { task: 'prayer', type: 'Experience', points: 10, target: 100_000 };
    const player: PlayerRow = { ...basePlayer, skillDeltas: { prayer: 10_482 } };
    const cell = getTileCell(tile, player);
    expect(cell.state).toBe('inProgress');
  });

  it('a genuinely un-started tile (no key at all, either casing) is "none", not a crash', () => {
    const tile: TileInfo = { task: 'hitpoints', type: 'Experience', points: 10, target: 20 };
    expect(getTileCell(tile, basePlayer).state).toBe('none');
  });

  it('a raw hiscore-cased-only key (the pre-fix backend shape) does NOT resolve — proves getTileCell normalizes its lookup rather than matching by luck', () => {
    const tile: TileInfo = { task: 'hitpoints', type: 'Experience', points: 10, target: 20 };
    // Only the real-cased key present, as the pre-fix backend used to emit
    // (keyed by the raw `curr.name` from the hiscores API).
    const player: PlayerRow = { ...basePlayer, skillDeltas: { Hitpoints: 500_215 } };
    expect(getTileCell(tile, player).state).toBe('none');
  });
});
