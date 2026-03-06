/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../config";
import { gotoWithBackoff, randomPause } from "./anti-bot";
import { getSourceTargets } from "./source-targets";
import type { ScrapeRecord } from "../types";
import type { BrowserSession } from "./playwright-runtime";

const costcoUsTargets = getSourceTargets("COSTCO_US");

async function setUsZipcode(page: any) {
  const triggerSelectors = [
    "button[data-testid='postal-code-trigger']",
    "button#delivery-postal-code-button",
    "button:has-text('Set Delivery')"
  ];

  for (const selector of triggerSelectors) {
    const trigger = page.locator(selector).first();
    if ((await trigger.count()) === 0) {
      continue;
    }

    await trigger.click().catch(() => null);
    await page.waitForTimeout(350);

    const input = page.locator("input[name='postalCode'], input[name='zipCode'], input#postal-code").first();
    if ((await input.count()) > 0) {
      await input.fill("95014").catch(() => null);
      await page.keyboard.press("Enter").catch(() => null);
      await page.waitForTimeout(1000);
      break;
    }
  }
}

async function scrapeCostcoUsPage(page: any, url: string): Promise<ScrapeRecord | null> {
  const title =
    (await page.locator("[data-testid='Text_brand-name']").first().textContent().catch(() => ""))?.trim() ||
    "Unknown Costco_US Item";

  let priceText =
    (await page.locator("[data-testid='Text_single-price-whole-value']").first().textContent().catch(() => ""))?.trim() ||
    "";
  if (!priceText) {
    priceText =
      (await page.locator("[automation-id='productPriceOutput']").first().textContent().catch(() => ""))?.trim() || "";
  }
  const price = Number(priceText.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(price) || price <= 0) {
    logger.warn("Costco US price not found", { url });
    return null;
  }

  const statusText =
    (await page.locator("[data-testid='Text_zipcode-status']").first().textContent().catch(() => ""))
      ?.trim()
      .toLowerCase() || "";

  return {
    platform: "Costco_US",
    title,
    price,
    currency: "USD",
    url,
    inStock: statusText.includes("available"),
    scrapedAt: new Date().toISOString()
  };
}

export async function scrapeCostcoUs(session: BrowserSession): Promise<ScrapeRecord[]> {
  const results: ScrapeRecord[] = [];
  if (costcoUsTargets.length === 0) {
    logger.warn("Costco US targets missing. Check COSTCO_US env.");
    return results;
  }

  for (const target of costcoUsTargets) {
    try {
      const row = await session.withPage(async (page) => {
        await gotoWithBackoff(page, target.url, "Costco_US");
        await randomPause(page, 500, 1600);
        await setUsZipcode(page);
        await randomPause(page, 800, 2200);
        return scrapeCostcoUsPage(page, target.url);
      });

      if (row) {
        results.push(row);
      }
    } catch (error) {
      logger.warn("Costco US scrape target failed", {
        url: target.url,
        reason: error instanceof Error ? error.message : "Unknown"
      });
    }
  }

  return results;
}
