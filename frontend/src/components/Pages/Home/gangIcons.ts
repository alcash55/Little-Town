// Every svg in assets/Images/gangs becomes a Home page icon, in filename order.
const gangFiles = import.meta.glob('/src/assets/Images/gangs/*.svg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

/**
 * The screen reader label for a gang file: `redHat` reads "red hat". The
 * filename is what gets announced, so name new files the way they should be
 * read aloud. gangIcons.test.ts pins the full list (see #59).
 */
export const labelFromFilename = (name: string): string =>
  name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

export interface GangIcon {
  /** Filename without extension, e.g. `redHat`. */
  name: string;
  src: string;
  label: string;
}

export const gangIcons: GangIcon[] = Object.entries(gangFiles)
  .map(([path, src]) => {
    const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '');
    return { name, src, label: labelFromFilename(name) };
  })
  // Plain code-unit order rather than localeCompare, so the row comes out the
  // same on every machine and CI runner.
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
