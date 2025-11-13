import puppeteer from "puppeteer";

export default async function scrapeOsrsSkills(): Promise<string[]> {
  const getData = async () => {
    const url =
      "https://runescape.wiki/w/Application_programming_interface#Hiscores_Lite_2";

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });

      // Scroll to ensure all content loads
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 500;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });

      // Wait for any <p> or <pre> to exist
      await page.waitForSelector("p", { timeout: 20000 });

      const data = await page.evaluate(() => {
        const paragraphs = Array.from(document.querySelectorAll("p"));
        const targetP = paragraphs.find((p) =>
          p.textContent
            ?.trim()
            .toLowerCase()
            .includes("the skills in order are")
        );

        if (!targetP) throw new Error(`Cannot find <p> element`);

        // Walk forward until we find the next <pre>
        let nextElem = targetP.nextElementSibling as Element | null;
        while (nextElem && nextElem.tagName.toLowerCase() !== "pre") {
          nextElem = nextElem.nextElementSibling as Element | null;
        }

        return nextElem?.textContent?.trim();
      });

      await browser.close();

      if (!data) {
        throw new Error("Unable to get OSRS skills list");
      }

      return data;
    } catch (e) {
      console.error("Scrape failed: ", e);
      throw new Error(`Error: ${e}`);
    }
  };

  const formatData = (skills: string): string[] => {
    return skills.split("\n");
  };

  const unformatedSkills = await getData();
  const formatSkills = formatData(unformatedSkills);

  console.log(formatSkills);

  return formatSkills;
}
