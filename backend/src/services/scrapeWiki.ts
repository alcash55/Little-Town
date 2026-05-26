import puppeteer, { Browser } from "puppeteer";

const WIKI_URL =
  "https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2";
const ANCHOR_SELECTOR = "a#Hiscores_Lite_2";
const PAGE_TIMEOUT_MS = 20000;

const SKILLS_CONTENT_KEYWORDS = ["overall\nattack", "overall", "constitution"];
const ACTIVITIES_CONTENT_KEYWORDS = [
  "grid points",
  "bounty hunter - hunter",
  "clue scrolls (all)",
];

// In-memory cache — persists for the lifetime of the server process
const cache = new Map<string, string[]>();

export default async function scrapeWiki(
  category: "skills" | "activities"
): Promise<string[]> {
  if (category !== "skills" && category !== "activities") {
    console.warn(`[scrapeWiki] Unrecognized category, defaulting to skills`);
    category = "skills";
  }

  // Return cached result if available
  if (cache.has(category)) {
    console.log(`[scrapeWiki] Returning cached result for: ${category}`);
    return cache.get(category)!;
  }

  console.log(`[scrapeWiki] Fetching fresh data for: ${category}`);

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(WIKI_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(ANCHOR_SELECTOR, { timeout: PAGE_TIMEOUT_MS });

    const extractedData = await page.evaluate(
      (evalCategory, evalAnchorSelector, evalSkillsKeywords, evalActivitiesKeywords) => {
        const anchor = document.querySelector(evalAnchorSelector);
        if (!anchor) throw new Error(`Could not find anchor: ${evalAnchorSelector}`);

        const allPre = Array.from(document.querySelectorAll("pre"));
        const relevantPre = allPre.filter(
          (pre) => anchor.compareDocumentPosition(pre) & Node.DOCUMENT_POSITION_FOLLOWING
        );

        const keywords = evalCategory === "skills" ? evalSkillsKeywords : evalActivitiesKeywords;
        const found = relevantPre.find((pre) =>
          keywords.some((kw) => (pre.textContent || "").toLowerCase().startsWith(kw))
        );

        if (!found) throw new Error(`Could not find <pre> for: ${evalCategory}`);
        return found.textContent?.trim();
      },
      category,
      ANCHOR_SELECTOR,
      SKILLS_CONTENT_KEYWORDS,
      ACTIVITIES_CONTENT_KEYWORDS
    );

    if (!extractedData) throw new Error("Empty data returned from wiki scrape.");

    const result = extractedData
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    cache.set(category, result);
    console.log(`[scrapeWiki] Cached ${result.length} items for: ${category}`);

    return result;
  } catch (error: any) {
    console.error(`[scrapeWiki] Failed for: ${category}`, error);
    throw new Error(`scrapeWiki error for ${category}: ${error.message || error}`);
  } finally {
    if (browser) await browser.close();
  }
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
