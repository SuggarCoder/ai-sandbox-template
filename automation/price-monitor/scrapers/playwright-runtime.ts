/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../config";
import { pickUserAgent, setupPageForScraping } from "./anti-bot";

export type BrowserSession = {
  close: () => Promise<void>;
  withPage: <T>(fn: (page: any) => Promise<T>) => Promise<T>;
};

const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;

export async function createBrowserSession(): Promise<BrowserSession> {
  let chromium: any;
  try {
    const playwrightExtra = await dynamicImport("playwright-extra");
    const stealth = (await dynamicImport("puppeteer-extra-plugin-stealth")).default;
    chromium = playwrightExtra.chromium;
    chromium.use(stealth());
    logger.info("Using playwright-extra stealth runtime");
  } catch (error) {
    const fallback = await dynamicImport("playwright");
    chromium = fallback.chromium;
    logger.warn("Stealth plugin unavailable, fallback to playwright runtime", {
      reason: error instanceof Error ? error.message : "Unknown"
    });
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-http2",
      "--disable-quic",
      "--disable-dev-shm-usage",
      "--no-sandbox"
    ]
  });

  const context = await browser.newContext({
    locale: "en-US",
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 960 },
    extraHTTPHeaders: {
      "accept-language": "en-US,en;q=0.9"
    },
    userAgent: pickUserAgent()
  });

  return {
    async close() {
      await context.close();
      await browser.close();
    },
    async withPage<T>(fn: (page: any) => Promise<T>): Promise<T> {
      const page = await context.newPage();
      try {
        await setupPageForScraping(page);
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "webdriver", { get: () => false });
          Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
          Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4] });
        });
        return await fn(page);
      } finally {
        await page.close();
      }
    }
  };
}
