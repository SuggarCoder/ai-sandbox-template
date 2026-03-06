/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../config";
import { gotoWithBackoff, randomPause } from "./anti-bot";
import { getSourceTargets } from "./source-targets";
import type { ScrapeRecord } from "../types";
import type { BrowserSession } from "./playwright-runtime";

const microcenterTargets = getSourceTargets("MICROCENTER");

async function parseMicrocenterPrice(page: any): Promise<number | null> {
  const candidates = [
    ".price",
    "[data-testid='product-price']",
    ".pricing .price-tag"
  ];

  for (const selector of candidates) {
    const text = await page.locator(selector).first().textContent().catch(() => null);
    if (!text) {
      continue;
    }

    const value = Number(text.replace(/[^\d.]/g, ""));
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

export async function scrapeMicrocenter(session: BrowserSession): Promise<ScrapeRecord[]> {
  const results: ScrapeRecord[] = [];
  if (microcenterTargets.length === 0) {
    logger.warn("Microcenter targets missing. Check MICROCENTER env.");
    return results;
  }

  for (const target of microcenterTargets) {
    try {
      const row = await session.withPage(async (page) => {
        await gotoWithBackoff(page, target.url, "microcenter");
        await randomPause(page, 700, 1700);

        const title =
          (await page.locator("h1").first().textContent().catch(() => ""))?.trim() ?? "Unknown Microcenter Item";
        const price = await parseMicrocenterPrice(page);

        if (!price) {
          logger.warn("Microcenter price not found", { url: target.url });
          return null;
        }

        const stockText = (await page.textContent("body").catch(() => ""))?.toLowerCase() ?? "";

        return {
          platform: "Microcenter",
          title,
          price,
          currency: "USD",
          url: target.url,
          inStock: !/out of stock|sold out|unavailable/.test(stockText),
          scrapedAt: new Date().toISOString()
        } satisfies ScrapeRecord;
      });

      if (row) {
        results.push(row);
      }
    } catch (error) {
      logger.warn("Microcenter scrape target failed", {
        url: target.url,
        reason: error instanceof Error ? error.message : "Unknown"
      });
    }
  }

  return results;
}
