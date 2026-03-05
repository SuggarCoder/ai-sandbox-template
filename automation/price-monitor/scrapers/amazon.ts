/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../config";
import type { ScrapeRecord } from "../types";
import type { BrowserSession } from "./playwright-runtime";

type AmazonTarget = {
  asin: string;
  hintModel?: "M4_Pro" | "M5_Pro";
};

const amazonTargets = [
  { asin: process.env.AMAZON_ASIN_M4_1 ?? "", hintModel: "M4_Pro" },
  { asin: process.env.AMAZON_ASIN_M4_2 ?? "", hintModel: "M4_Pro" },
  { asin: process.env.AMAZON_ASIN_M5_1 ?? "", hintModel: "M5_Pro" },
  { asin: process.env.AMAZON_ASIN_M5_2 ?? "", hintModel: "M5_Pro" }
] satisfies AmazonTarget[];

const activeAmazonTargets = amazonTargets.filter((target) => Boolean(target.asin));

async function parseAmazonPrice(page: any): Promise<number | null> {
  const selectors = [
    "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
    "#corePrice_feature_div .a-price .a-offscreen",
    "#price_inside_buybox"
  ];

  for (const selector of selectors) {
    const text = await page.locator(selector).first().textContent().catch(() => null);
    if (!text) {
      continue;
    }

    const cleaned = text.replace(/[^\d.]/g, "");
    const value = Number(cleaned);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function isCaptcha(pageContent: string) {
  return /captcha|enter the characters you see/i.test(pageContent);
}

async function gotoWithRetry(page: any, url: string) {
  let lastError: unknown;
  const attempts: Array<"domcontentloaded" | "load" | "commit"> = ["domcontentloaded", "load", "commit"];

  for (const waitUntil of attempts) {
    try {
      await page.goto(url, { waitUntil, timeout: 45000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(900);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to navigate: ${url}`);
}

export async function scrapeAmazon(session: BrowserSession): Promise<ScrapeRecord[]> {
  const results: ScrapeRecord[] = [];
  if (activeAmazonTargets.length === 0) {
    logger.warn("Amazon targets missing. Check AMAZON_ASIN_* secrets.");
    return results;
  }

  for (const target of activeAmazonTargets) {
    const url = `https://www.amazon.com/dp/${target.asin}`;

    try {
      const row = await session.withPage(async (page) => {
        let retries = 0;
        while (retries < 3) {
          await gotoWithRetry(page, url);
          const html = await page.content();

          if (isCaptcha(html)) {
            retries += 1;
            await page.waitForTimeout(1200 * retries);
            continue;
          }

          await page.waitForTimeout(1000);
          const title =
            (await page.locator("#productTitle").first().textContent().catch(() => ""))?.trim() ??
            "Unknown Amazon Item";

          const price = await parseAmazonPrice(page);
          const inStockText =
            (await page.locator("#availability").first().textContent().catch(() => ""))?.trim().toLowerCase() ?? "";

          if (!price) {
            logger.warn("Amazon price not found", { url });
            return null;
          }

          return {
            model: target.hintModel ?? "M4_Pro",
            platform: "Amazon",
            title,
            price,
            currency: "USD",
            url,
            inStock: !inStockText.includes("unavailable"),
            scrapedAt: new Date().toISOString()
          } satisfies ScrapeRecord;
        }

        logger.warn("Amazon captcha retry exhausted", { url });
        return null;
      });

      if (row) {
        results.push(row);
      }
    } catch (error) {
      logger.warn("Amazon scrape target failed", {
        url,
        reason: error instanceof Error ? error.message : "Unknown"
      });
      continue;
    }
  }

  return results;
}
