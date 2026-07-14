/**
 * Runtime resolver: bingo tile `task` free text -> bundled art URL
 * (TEAM-BRIEF.md Sprint 8, Track A items 1-2). Used by `BingoTile.tsx`.
 *
 * The curated entity list (canonical names + aliases + which asset file
 * backs each) lives in `bingoArtEntities.ts` — hand-edit that file to add
 * or fix a mapping, then `bun run art:bingo` (from `frontend/`) to fetch the
 * image. This file only does matching + asset resolution.
 *
 * Never hotlinks the OSRS wiki: images are pre-downloaded, committed assets
 * under `assets/Images/bosses/`, loaded here the same way
 * `Resources/imageLoader.ts` loads its bundled images (`import.meta.glob`,
 * eager). Unmatched tasks resolve to `undefined` — callers (BingoTile) MUST
 * degrade to the existing text-only tile design, never a broken `<img>`.
 */
import { BINGO_ART_ENTITIES, type BingoArtEntity } from './bingoArtEntities';

const bundledImages = import.meta.glob('/src/assets/Images/bosses/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

/** slug -> bundled asset URL, built once from whatever actually downloaded. */
const urlBySlug: Record<string, string> = {};
for (const [path, url] of Object.entries(bundledImages)) {
  const fileName = path.split('/').pop()!;
  const slug = fileName.replace(/\.[^.]+$/, '');
  urlBySlug[slug] = url;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Suffixes the OSRS hiscores API appends to a base activity name for a
 * harder variant (e.g. "Chambers of Xeric: Challenge Mode") — stripped
 * before falling back to a match on the base name, since the art is the
 * same entity either way.
 */
const VARIANT_SUFFIXES = [
  ': challenge mode',
  ': hard mode',
  ': expert mode',
  ' (hard mode)',
  ' (challenge mode)',
  ' (expert mode)',
];

function stripVariantSuffix(normalized: string): string | null {
  for (const suffix of VARIANT_SUFFIXES) {
    if (normalized.endsWith(suffix)) return normalized.slice(0, -suffix.length).trim();
  }
  return null;
}

/** normalized match key -> entity, built once (canonical name + every alias). */
const entityByKey = new Map<string, BingoArtEntity>();
for (const entity of BINGO_ART_ENTITIES) {
  entityByKey.set(normalize(entity.canonical), entity);
  for (const alias of entity.aliases ?? []) {
    entityByKey.set(normalize(alias), entity);
  }
}

// Substring fallback only considers reasonably specific keys (>= 5 chars)
// so short/generic aliases (e.g. "jad", "wc") can't false-positive match
// inside unrelated free text — those still work fine as exact matches.
const substringCandidates = [...entityByKey.entries()]
  .filter(([key]) => key.length >= 5)
  .sort((a, b) => b[0].length - a[0].length); // longest first: prefer the more specific match

function findEntity(task: string): BingoArtEntity | undefined {
  const normalized = normalize(task);
  if (!normalized) return undefined;

  const exact = entityByKey.get(normalized);
  if (exact) return exact;

  const stripped = stripVariantSuffix(normalized);
  if (stripped) {
    const strippedMatch = entityByKey.get(stripped);
    if (strippedMatch) return strippedMatch;
  }

  // Whole-word substring match, e.g. task "General Graardor KC" or
  // "Twisted bow (from ToB)" still resolving their entity.
  for (const [key, entity] of substringCandidates) {
    const wordBoundary = new RegExp(
      `(^|[^a-z0-9'])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9']|$)`,
    );
    if (wordBoundary.test(normalized)) return entity;
  }

  return undefined;
}

/**
 * Resolves a bingo tile's free-text `task` to a bundled art URL, or
 * `undefined` if nothing matches (BingoTile falls back to text-only).
 */
export function resolveBingoArt(task: string): string | undefined {
  const entity = findEntity(task);
  if (!entity) return undefined;
  return urlBySlug[entity.slug];
}
