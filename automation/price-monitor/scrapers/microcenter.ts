/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../config";
import { gotoWithBackoff, randomPause } from "./anti-bot";
import { getSourceTargets } from "./source-targets";
import type { ScrapeRecord } from "../types";
import type { BrowserSession } from "./playwright-runtime";

const microcenterTargets = getSourceTargets("MICROCENTER");

async function parseMicrocenterTitle(page: any): Promise<string> {
  const detail =
    (await page
      .locator("div.product-header h1 span span")
      .first()
      .textContent()
      .catch(() => ""))?.trim() ?? "";

  if (detail) {
    return detail;
  }

  const fallback = (await page.locator("div.product-header h1").first().textContent().catch(() => ""))?.trim() ?? "";
  return fallback || "Unknown Microcenter Item";
}

async function parseMicrocenterPrice(page: any): Promise<number | null> {
  const content = await page.locator("span#pricing").first().getAttribute("content").catch(() => null);
  if (!content) {
    return null;
  }

  const value = Number(content.replace(/[^\d.]/g, ""));
  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return null;
}

async function parseMicrocenterOriginalPrice(page: any): Promise<number | undefined> {
  const text = await page.locator("strike").first().textContent().catch(() => null);
  if (!text) {
    return undefined;
  }

  const cleaned = text.replace(/Original price/i, "").replace(/[^\d.]/g, "");
  const value = Number(cleaned);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return undefined;
}

async function parseMicrocenterStock(page: any): Promise<number> {
  const text = await page.locator("span.inventoryCnt").first().textContent().catch(() => null);
  if (!text) {
    return 0;
  }

  const match = text.match(/\d+/);
  if (!match) {
    return 0;
  }

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : 0;
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

        const title = await parseMicrocenterTitle(page);
        const price = await parseMicrocenterPrice(page);

        if (!price) {
          logger.warn("Microcenter price not found", { url: target.url });
          return null;
        }

        const originalPrice = await parseMicrocenterOriginalPrice(page);
        const stockCount = await parseMicrocenterStock(page);

        return {
          platform: "Microcenter",
          title,
          price,
          currency: "USD",
          url: target.url,
          inStock: stockCount > 0,
          originalPrice,
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
