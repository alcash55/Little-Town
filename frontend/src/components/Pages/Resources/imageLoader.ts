/**
 * Resolves a DATA CONTRACT image path (relative to
 * `.../assets/Images/resources/`, e.g. "tob/bad-crabs.jpg") to a bundled
 * asset URL. Missing images resolve to `undefined` — callers must degrade to
 * a placeholder, never a broken <img>.
 *
 * Real data-engineer assets live under `src/assets/Images/resources/**`
 * (R2.a). Until that lands, `__fixtures__/images/**` is also merged in so
 * the fixture manifest in `resourcesFixture.ts` can exercise this exact
 * resolution path end to end. Remove the fixture glob at integration once
 * the real manifest is wired in.
 */

const realImages = import.meta.glob(
  '/src/assets/Images/resources/**/*.{png,jpg,jpeg,webp,gif}',
  { eager: true, import: 'default' },
) as Record<string, string>;

const fixtureImages = import.meta.glob(
  '/src/components/Pages/Resources/__fixtures__/images/**/*.{png,jpg,jpeg,webp,gif}',
  { eager: true, import: 'default' },
) as Record<string, string>;

function keyAfter(fullPath: string, marker: string): string | null {
  const idx = fullPath.indexOf(marker);
  return idx === -1 ? null : fullPath.slice(idx + marker.length);
}

const imageMap: Record<string, string> = {};

for (const [path, url] of Object.entries(realImages)) {
  const key = keyAfter(path, '/assets/Images/resources/');
  if (key) imageMap[key] = url;
}

for (const [path, url] of Object.entries(fixtureImages)) {
  const key = keyAfter(path, '/__fixtures__/images/');
  if (key) imageMap[key] = url;
}

/** Returns a bundled URL for a resource image path, or undefined if missing. */
export function resolveResourceImage(relativePath: string): string | undefined {
  return imageMap[relativePath];
}
