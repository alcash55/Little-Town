/**
 * Fetches the OSRS hiscores skill/activity lists from the RuneScape wiki
 * using the MediaWiki parse API — no headless browser needed.
 *
 * The API returns the wikitext of the page, which contains <pre> blocks
 * with the same skill/activity data that was previously scraped via Puppeteer.
 */

const MEDIAWIKI_API =
  "https://runescape.wiki/api.php?action=parse&page=Application_programming_interface&prop=wikitext&section=0&format=json&origin=*";

const SKILLS_KEYWORDS = ["overall", "attack", "constitution"];
const ACTIVITIES_KEYWORDS = ["grid points", "bounty hunter", "clue scrolls"];

// In-memory cache — persists for the lifetime of the server process
const cache = new Map<string, string[]>();

export default async function scrapeWiki(
  category: "skills" | "activities"
): Promise<string[]> {
  if (category !== "skills" && category !== "activities") {
    console.warn(`[scrapeWiki] Unrecognized category, defaulting to skills`);
    category = "skills";
  }

  if (cache.has(category)) {
    console.log(`[scrapeWiki] Returning cached result for: ${category}`);
    return cache.get(category)!;
  }

  console.log(`[scrapeWiki] Fetching fresh data for: ${category}`);

  // Fetch the full wikitext of the API page
  const res = await fetch(MEDIAWIKI_API, {
    headers: { "User-Agent": "LittleTownBot/1.0 (little-town.onrender.com)" },
  });

  if (!res.ok) {
    throw new Error(`Wiki API request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json() as any;
  const wikitext: string = json?.parse?.wikitext?.["*"] ?? "";

  if (!wikitext) {
    throw new Error("Empty wikitext returned from wiki API");
  }

  // Extract <pre>...</pre> blocks from wikitext
  const preBlocks = [...wikitext.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map(
    (m) => m[1].trim().toLowerCase()
  );

  const keywords = category === "skills" ? SKILLS_KEYWORDS : ACTIVITIES_KEYWORDS;

  const matchedBlock = preBlocks.find((block) =>
    keywords.every((kw) => block.includes(kw))
  );

  if (!matchedBlock) {
    throw new Error(`Could not find <pre> block for category: ${category}`);
  }

  const result = matchedBlock
    .split("\n")
    .map((s: string) => s.trim())
    .filter(Boolean);

  cache.set(category, result);
  console.log(`[scrapeWiki] Cached ${result.length} items for: ${category}`);

  return result;
}

/**
 * Pre-warms the cache for both skills and activities at server startup.
 * Errors are swallowed so they don't prevent the server from starting.
 */
export async function prewarmScrapeCache(): Promise<void> {
  console.log("[scrapeWiki] Pre-warming cache...");
  await Promise.allSettled([
    scrapeWiki("skills"),
    scrapeWiki("activities"),
  ]);
  console.log("[scrapeWiki] Cache pre-warm complete.");
}
