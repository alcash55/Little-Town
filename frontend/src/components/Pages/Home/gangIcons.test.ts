import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gangIcons, labelFromFilename } from './gangIcons';

// Read from disk rather than trusting the glob, so a file the glob misses
// shows up here.
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

  // The filename is what screen readers hear, and one once read "Little Town
  // cum logo" (#59). Pinning the list makes a new or renamed file fail here
  // until someone has looked at what it will announce.
  it('announces exactly these labels', () => {
    expect(
      gangIcons.map((icon) => icon.label),
      'a gang file was added or renamed; check its label reads well aloud, then update this list',
    ).toEqual([
      'astral',
      'black heart',
      'cat',
      'fish',
      'foot',
      'guthix',
      'ketchup',
      'red hat',
      'skull',
    ]);
  });

  it.each([
    ['cat', 'cat'],
    ['blackHeart', 'black heart'],
    ['redHat', 'red hat'],
    ['bigRedHat', 'big red hat'],
  ])('turns the filename %s into the label "%s"', (name, label) => {
    expect(labelFromFilename(name)).toBe(label);
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
