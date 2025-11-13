import puppeteer, { Browser, Page } from "puppeteer";

const WIKI_URL =
  "https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2";
const ANCHOR_SELECTOR = "a#Hiscores_Lite_2";
const PAGE_TIMEOUT_MS = 20000; // 20 seconds

const SKILLS_CONTENT_KEYWORDS = ["overall\nattack", "overall", "constitution"];
const ACTIVITIES_CONTENT_KEYWORDS = [
  "grid points",
  "bounty hunter - hunter",
  "clue scrolls (all)",
];

const SKILLS_WARNING_TEXT = "Unrecognized category (using skills as default)";

/**
 * Scrapes the RuneScape Wiki for a list of skills or activities.
 *
 * @param category The category to scrape ('skills' or 'activities').
 * @returns A promise that resolves to an array of strings (the list items).
 */
export default async function scrapeWiki(
  category: "skills" | "activities"
): Promise<string[]> {
  console.log(`[scrapeWiki] Called with category: ${category}`);

  // Handle unrecognized categories by defaulting to 'skills'
  if (category !== "skills" && category !== "activities") {
    console.warn(`[scrapeWiki] ${SKILLS_WARNING_TEXT}: ${category}`);
    category = "skills";
  }

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true, // true for production, false for debugging UI
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Removed page.on('console', ...) as debugging logs are no longer needed

    await page.goto(WIKI_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(ANCHOR_SELECTOR, { timeout: PAGE_TIMEOUT_MS });

    console.log(
      `[scrapeWiki] Page loaded and anchor found. Extracting data for: ${category}`
    );

    const extractedData = await page.evaluate(
      (
        evalCategory,
        evalAnchorSelector,
        evalSkillsContentKeywords,
        evalActivitiesContentKeywords
      ) => {
        const hiscoresAnchor = document.querySelector(evalAnchorSelector);
        if (!hiscoresAnchor) {
          throw new Error(
            `[PAGE_EVAL] Could not find the anchor: ${evalAnchorSelector}`
          );
        }

        const allPreElements = Array.from(document.querySelectorAll("pre"));

        // Filter <pre> elements that appear *after* the Hiscores Lite section anchor
        const relevantPreElements = allPreElements.filter((pre) => {
          return (
            hiscoresAnchor.compareDocumentPosition(pre) &
            Node.DOCUMENT_POSITION_FOLLOWING
          );
        });

        let foundPreElement: HTMLPreElement | undefined;
        let validationKeywords: string[];

        if (evalCategory === "skills") {
          validationKeywords = evalSkillsContentKeywords;
        } else {
          validationKeywords = evalActivitiesContentKeywords;
        }

        foundPreElement = relevantPreElements.find((pre) => {
          const preText = pre.textContent || "";
          // Check if the preText starts with any of the validation keywords
          return validationKeywords.some((keyword) =>
            preText.toLowerCase().startsWith(keyword)
          );
        });

        if (!foundPreElement) {
          throw new Error(
            `[PAGE_EVAL] Could not find the correct <pre> element for category: '${evalCategory}'`
          );
        }

        return foundPreElement.textContent?.trim();
      },
      category,
      ANCHOR_SELECTOR,
      SKILLS_CONTENT_KEYWORDS,
      ACTIVITIES_CONTENT_KEYWORDS
    );

    if (!extractedData) {
      throw new Error("Unable to get OSRS skills/activities list: Empty data.");
    }

    const formattedData = formatData(extractedData);
    console.log(
      `[scrapeWiki] Final result for category: ${category}`,
      formattedData
    );
    return formattedData;
  } catch (error: any) {
    console.error(`[scrapeWiki] Scrape failed for: ${category}`, error);
    throw new Error(
      `Error during scrapeWiki for ${category}: ${error.message || error}`
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Formats the raw scraped string data into an array of trimmed, non-empty strings.
 * @param data The raw string data from the <pre> tag.
 * @returns An array of formatted strings.
 */
function formatData(data: string): string[] {
  return data
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
