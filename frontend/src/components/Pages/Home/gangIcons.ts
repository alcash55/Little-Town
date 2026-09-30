// Every svg in assets/Images/gangs becomes a Home page icon, in filename order.
const gangFiles = import.meta.glob('/src/assets/Images/gangs/*.svg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

// Explicit, reviewed accessible name per icon, not derived from the asset
// filename. A sliced filename was previously announced verbatim to screen
// reader users, including one that read "Little Town cum logo" (see #59).
// gangIcons.test.ts fails for any file in gangs/ that is missing from here.
export const GANG_LABELS: Record<string, string> = {
  astral: 'astral',
  blackHeart: 'black heart',
  cat: 'cat',
  cum: 'relish',
  fish: 'fish',
  foot: 'foot',
  ketchup: 'ketchup',
  redHat: 'red hat',
  skull: 'skull',
};

export interface GangIcon {
  /** Filename without extension, e.g. `redHat`. */
  name: string;
  src: string;
  /** Undefined only when a new file has not been labelled yet. */
  label: string | undefined;
}

export const gangIcons: GangIcon[] = Object.entries(gangFiles)
  .map(([path, src]) => {
    const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '');
    return { name, src, label: GANG_LABELS[name] };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
