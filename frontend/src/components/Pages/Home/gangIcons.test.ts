import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GANG_LABELS, gangIcons } from './gangIcons';

// Read from disk rather than trusting the glob, so a file the glob misses and
// a file with no reviewed label both show up here.
const gangsDir = resolve(__dirname, '../../../assets/Images/gangs');
const filesOnDisk = readdirSync(gangsDir)
  .filter((file) => file.endsWith('.svg'))
  .map((file) => file.replace(/\.svg$/, ''))
  .sort();

describe('gangIcons', () => {
  it('renders one icon per svg in assets/Images/gangs', () => {
    expect(
      gangIcons.map((icon) => icon.name),
      `gangs/ holds ${filesOnDisk.join(', ')}`,
    ).toEqual(filesOnDisk);
  });

  it('has a reviewed label for every file in gangs/', () => {
    const unlabeled = filesOnDisk.filter((name) => !(name in GANG_LABELS));
    expect(
      unlabeled,
      'add each of these to GANG_LABELS in gangIcons.ts; the filename is never used as alt text (#59)',
    ).toEqual([]);
  });

  it('has no label left over for a file that is gone', () => {
    const stale = Object.keys(GANG_LABELS).filter((name) => !filesOnDisk.includes(name));
    expect(stale, 'remove these from GANG_LABELS').toEqual([]);
  });

  // guthix.svg was cum.svg, whose filename once reached screen readers (#59).
  it('announces guthix.svg as "guthix"', () => {
    expect(gangIcons.find((icon) => icon.name === 'guthix')?.label).toBe('guthix');
  });

  // Vite inlines svgs under the 4 kB asset limit as data URIs and emits the
  // rest as files, so either form is a working src.
  it('resolves every icon to an image URL', () => {
    for (const icon of gangIcons) {
      expect(icon.src, `${icon.name} did not resolve to an image`).toMatch(
        /^data:image\/svg\+xml|gangs\/.+\.svg$/,
      );
    }
  });
});
