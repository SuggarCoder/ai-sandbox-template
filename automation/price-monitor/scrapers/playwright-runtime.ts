/* eslint-disable @typescript-eslint/no-explicit-any */
export type BrowserSession = {
  close: () => Promise<void>;
  withPage: <T>(fn: (page: any) => Promise<T>) => Promise<T>;
};

const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;

export async function createBrowserSession(): Promise<BrowserSession> {
  const { chromium } = await dynamicImport("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });

  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 960 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  });

  return {
    async close() {
      await context.close();
      await browser.close();
    },
    async withPage<T>(fn: (page: any) => Promise<T>): Promise<T> {
      const page = await context.newPage();
      try {
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "webdriver", { get: () => false });
        });
        return await fn(page);
      } finally {
        await page.close();
      }
    }
  };
}
