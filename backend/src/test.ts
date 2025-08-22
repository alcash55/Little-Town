import puppeteer from "puppeteer";

async function testPuppeteer() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://example.com");
  console.log("Page loaded!");
  await browser.close();
}

testPuppeteer();
