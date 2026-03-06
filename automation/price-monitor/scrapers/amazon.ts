/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../config";
import { gotoWithBackoff, isBlockedContent, randomPause } from "./anti-bot";
import { getSourceTargets } from "./source-targets";
import type { ScrapeRecord } from "../types";
import type { BrowserSession } from "./playwright-runtime";

const amazonTargets = getSourceTargets("AMAZON");

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

export async function scrapeAmazon(session: BrowserSession): Promise<ScrapeRecord[]> {
  const results: ScrapeRecord[] = [];
  if (amazonTargets.length === 0) {
    logger.warn("Amazon targets missing. Check AMAZON env.");
    return results;
  }

  for (const target of amazonTargets) {
    const url = target.url;

    try {
      const row = await session.withPage(async (page) => {
        let retries = 0;
        while (retries < 3) {
          await gotoWithBackoff(page, url, "amazon");
          const html = await page.content();

          if (isCaptcha(html) || isBlockedContent(html)) {
            retries += 1;
            await randomPause(page, 1000, 2400 * retries);
            continue;
          }

          await randomPause(page, 700, 1800);
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
    }
  }

  return results;
}
