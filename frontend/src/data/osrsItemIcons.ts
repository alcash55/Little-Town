/**
 * General (non-curated) item-icon resolver for Drops bingo tiles
 * (TEAM-BRIEF.md Sprint 9, Track B item 2).
 *
 * Curated `bingoArtEntities.ts` art (large "detail" renders, committed to
 * the repo, downloaded via `download-bingo-art.ts`) always wins when a
 * task matches one — see `bingoArt.ts`. This module is the fallback for
 * the remaining ~4,000 OSRS items a Drops task can legitimately name (the
 * same full item list `BoardBuilder`'s Autocomplete offers, via
 * `useBoardBuilder.ts`'s `getItemMappings()` against
 * `prices.runescape.wiki/api/v1/osrs/mapping`): rather than hand-curating
 * art for every possible item (unbounded, constant upkeep, and the item
 * list changes over time), this resolves the task's exact item name to its
 * OSRS item id via that same public mapping, then points at Jagex's own
 * official Grand Exchange sprite CDN at runtime.
 *
 * Deliberately NOT a committed-asset pipeline like `download-bingo-art.ts`:
 * a bounded curated set would always be behind whatever items boards
 * actually put on Drops tiles, and the sprite endpoint is small (~36x32
 * GIFs), served directly by Jagex (not the wiki — no fair-use scraping
 * concern to manage), so there's no meaningful repo-bloat tradeoff to make
 * by fetching it at runtime instead. `BingoTile` treats a failed/missing
 * load (icon renamed/removed, network error) as "no icon" and falls back
 * to the plain text tile — never a broken `<img>`.
 */
import { useEffect, useState } from 'react';
import { cachedFetch } from '../utils/cachedFetch';

const ITEM_MAPPING_URL = 'https://prices.runescape.wiki/api/v1/osrs/mapping';
const GE_SPRITE_BASE = 'https://secure.runescape.com/m=itemdb_oldschool/obj_sprite.gif?id=';

interface OsrsItemMappingEntry {
  id: number;
  name: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function loadIdByName(): Promise<Map<string, number>> {
  // Trimmed to {id, name} before caching — this is the payload that lands
  // in sessionStorage, keeping it well clear of quota vs. caching every
  // field the wiki's mapping endpoint returns (buy limits, alch values...).
  const entries = await cachedFetch('osrs:item-id-mapping', async () => {
    const res = await fetch(ITEM_MAPPING_URL, {
      headers: { 'User-Agent': 'https://littletown.gay/' },
    });
    if (!res.ok) throw new Error(`Failed to fetch OSRS item mapping: ${res.status}`);
    const data: OsrsItemMappingEntry[] = await res.json();
    return data.map((d) => ({ id: d.id, name: d.name }));
  });

  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(normalize(entry.name), entry.id);
  }
  return map;
}

// Memoized across every caller/tile — the mapping fetch only ever happens
// once per tab session (cachedFetch backs the underlying request with
// sessionStorage too, so a fresh tab also skips the network round trip
// once BoardBuilder or a prior BingoBoard visit already populated it).
let idByNamePromise: Promise<Map<string, number>> | null = null;
function getIdByName(): Promise<Map<string, number>> {
  if (!idByNamePromise) idByNamePromise = loadIdByName();
  return idByNamePromise;
}

/**
 * Loads (and memoizes) the OSRS item name -> id mapping, only when
 * `enabled` — callers should gate this on "this tile actually needs a
 * fallback icon" (Drops type, no curated art) so boards with no
 * icon-needing tiles never pay for the ~4,000-item fetch at all.
 */
export function useOsrsItemIdByName(enabled: boolean): Map<string, number> | null {
  const [map, setMap] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getIdByName()
      .then((m) => {
        if (!cancelled) setMap(m);
      })
      .catch((e) => console.error('Failed to load OSRS item mapping for tile icons:', e));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return map;
}

/**
 * Resolves a Drops tile's exact item-name `task` to its official OSRS GE
 * sprite URL, or `undefined` if the mapping hasn't loaded yet or the name
 * doesn't match any item. Callers MUST still handle image load failure —
 * this can't guarantee the URL 200s (item renamed/delisted since the
 * mapping was cached, network error, etc.).
 */
export function resolveItemIconUrl(
  task: string,
  idByName: Map<string, number> | null,
): string | undefined {
  if (!idByName) return undefined;
  const id = idByName.get(normalize(task));
  if (id === undefined) return undefined;
  return `${GE_SPRITE_BASE}${id}`;
}
