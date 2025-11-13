import puppeteer from "puppeteer";

/**
 * Scrapes the OSRS Hiscores Lite example payload for Activities from the RuneScape Wiki page.
 * This is intended for documentation/demo purposes, not production data.
 * @returns The contents of the <pre> tag containing the OSRS Activities example, or null if not found.
 */
export default async function scrapeOsrsActivities(): Promise<string | null> {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--no-first-run",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-client-side-phishing-detection",
        "--disable-default-apps",
        "--disable-hang-monitor",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-sync",
        "--disable-translate",
        "--metrics-recording-only",
        "--no-default-browser-check",
        "--safebrowsing-disable-auto-update",
        "--enable-automation",
        "--password-store=basic",
      ],
    });
    const page = await browser.newPage();

    const url =
      "https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2";
    await page.goto(url, { waitUntil: "domcontentloaded" });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const data = await page.evaluate(() => {
      const headers = Array.from(
        document.querySelectorAll("h2, h3, h4, h5, h6")
      );

      const osrsIndex = headers.findIndex((el) =>
        el.textContent?.toLowerCase().includes("old school runescape")
      );

      if (osrsIndex === -1) return null;

      for (let i = osrsIndex + 1; i < headers.length; i++) {
        const header = headers[i];
        const text = header.textContent?.toLowerCase() || "";

        // Stop searching if we reached another major section unrelated to OSRS
        if (text.includes("runescape 3") || text.includes("rs3")) break;

        if (text.includes("activities")) {
          let nextElem = header.nextElementSibling as Element | null;
          while (nextElem && nextElem.tagName.toLowerCase() !== "pre") {
            nextElem = nextElem.nextElementSibling as Element | null;
          }
          return (nextElem as HTMLElement | null)?.textContent || null;
        }
      }

      return null;
    });

    await browser.close();
    console.log("Scraped OSRS Hiscores Lite Activities example:", data);
    return data;
  } catch (e) {
    console.error(`Unable to scrape data: ${e}`);
    return null;
  }
}
