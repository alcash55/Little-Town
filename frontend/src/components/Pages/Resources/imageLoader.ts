/**
 * Resolves a DATA CONTRACT image path (relative to
 * `.../assets/Images/resources/`, e.g. "tob/bad-crabs.jpg") to a bundled
 * asset URL. Missing images resolve to `undefined` — callers must degrade to
 * a placeholder, never a broken <img>.
 *
 * Assets live under `src/assets/Images/resources/**` (R2.a).
 */

// `?no-inline` keeps every image a separate file. Without it, Vite base64-inlines
// anything under `build.assetsInlineLimit` (4 kB) into the Resources JS chunk,
// which added ~21 kB of image data to the script whether or not a card showed.
const realImages = import.meta.glob('/src/assets/Images/resources/**/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
  query: '?no-inline',
}) as Record<string, string>;

function keyAfter(fullPath: string, marker: string): string | null {
  const idx = fullPath.indexOf(marker);
  return idx === -1 ? null : fullPath.slice(idx + marker.length);
}

const imageMap: Record<string, string> = {};

for (const [path, url] of Object.entries(realImages)) {
  const key = keyAfter(path, '/assets/Images/resources/');
  if (key) imageMap[key] = url;
}

/** Returns a bundled URL for a resource image path, or undefined if missing. */
export function resolveResourceImage(relativePath: string): string | undefined {
  return imageMap[relativePath];
}
