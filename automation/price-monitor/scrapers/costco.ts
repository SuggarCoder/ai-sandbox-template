/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../config";
import { gotoWithBackoff, randomPause } from "./anti-bot";
import { getSourceTargets } from "./source-targets";
import type { ScrapeRecord } from "../types";
import type { BrowserSession } from "./playwright-runtime";

const costcoUsTargets = getSourceTargets("COSTCO_US");
const costcoCaTargets = getSourceTargets("COSTCO_CA");

async function setZipOrPostalCode(page: any, platform: "Costco_US" | "Costco_CA") {
  const zipcode = platform === "Costco_US" ? "95014" : "M4Y0G7";
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
      await input.fill(zipcode).catch(() => null);
      await page.keyboard.press("Enter").catch(() => null);
      await page.waitForTimeout(1000);
      break;
    }
  }
}

async function parseCostcoCurrentPrice(page: any): Promise<number | null> {
  const text = await page
    .locator("[data-testid='Text_single-price-whole-value']")
    .first()
    .textContent()
    .catch(() => null);

  if (!text) {
    return null;
  }

  const value = Number(text.replace(/[^\d.]/g, ""));
  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return null;
}

async function scrapeCostcoPlatform(
  session: BrowserSession,
  platform: "Costco_US" | "Costco_CA",
  targets: Array<{ url: string }>
): Promise<ScrapeRecord[]> {
  const results: ScrapeRecord[] = [];
  const currency = platform === "Costco_CA" ? "CAD" : "USD";

  for (const target of targets) {
    try {
      const row = await session.withPage(async (page) => {
        await gotoWithBackoff(page, target.url, platform);
        await randomPause(page, 500, 1600);
        await setZipOrPostalCode(page, platform);
        await randomPause(page, 800, 2200);

        const title =
          (await page.locator("[data-testid='Text_brand-name']").first().textContent().catch(() => ""))?.trim() ??
          `Unknown ${platform} Item`;

        const price = await parseCostcoCurrentPrice(page);
        if (!price) {
          logger.warn("Costco price not found", { url: target.url, platform });
          return null;
        }

        const statusText =
          (await page.locator("[data-testid='Text_zipcode-status']").first().textContent().catch(() => ""))
            ?.trim()
            .toLowerCase() ?? "";

        return {
          platform,
          title,
          price,
          currency,
          url: target.url,
          inStock: statusText.includes("available"),
          scrapedAt: new Date().toISOString()
        } satisfies ScrapeRecord;
      });

      if (row) {
        results.push(row);
      }
    } catch (error) {
      logger.warn("Costco scrape target failed", {
        url: target.url,
        platform,
        reason: error instanceof Error ? error.message : "Unknown"
      });
    }
  }

  return results;
}

export async function scrapeCostcoUs(session: BrowserSession): Promise<ScrapeRecord[]> {
  if (costcoUsTargets.length === 0) {
    logger.warn("Costco US targets missing. Check COSTCO_US env.");
  }
  return scrapeCostcoPlatform(session, "Costco_US", costcoUsTargets);
}

export async function scrapeCostcoCa(session: BrowserSession): Promise<ScrapeRecord[]> {
  if (costcoCaTargets.length === 0) {
    logger.warn("Costco CA targets missing. Check COSTCO_CA env.");
  }
  return scrapeCostcoPlatform(session, "Costco_CA", costcoCaTargets);
}
