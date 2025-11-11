import puppeteer from "puppeteer";

/**
 * Scrapes the OSRS Hiscores Lite example payload from the RuneScape Wiki page.
 * This is intended for documentation/demo purposes, not production data.
 * @returns The contents of the <pre> tag containing the OSRS Hiscores Lite example, or null if not found.
 */
export default async function scrapeOsrsSkills(): Promise<string | null> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  const url =
    "https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2";
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const data = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll("h3, h4"));

    const osrsHeader = headers.find((el) =>
      el.textContent?.toLowerCase().includes("old school runescape")
    );

    if (!osrsHeader) return null;

    let nextElem = osrsHeader.nextElementSibling as Element | null;
    while (nextElem && nextElem.tagName.toLowerCase() !== "pre") {
      nextElem = nextElem.nextElementSibling as Element | null;
    }

    return (nextElem as HTMLElement | null)?.textContent || null;
  });

  await browser.close();
  console.log("Scraped OSRS skills:", data);
  return data;
}
