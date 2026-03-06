/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../config";
import { gotoWithBackoff, randomPause } from "./anti-bot";
import type { ScrapeRecord } from "../types";
import type { BrowserSession } from "./playwright-runtime";

type CostcoTarget = {
  url: string;
  hintModel?: "M4_Pro" | "M5_Pro";
};

const costcoUsTargets = [
  { url: process.env.COSTCO_US_M4_URL ?? "", hintModel: "M4_Pro" },
  { url: process.env.COSTCO_US_M5_URL ?? "", hintModel: "M5_Pro" }
] satisfies CostcoTarget[];

const costcoCaTargets = [
  { url: process.env.COSTCO_CA_M4_URL ?? "", hintModel: "M4_Pro" },
  { url: process.env.COSTCO_CA_M5_URL ?? "", hintModel: "M5_Pro" }
] satisfies CostcoTarget[];

const activeCostcoUsTargets = costcoUsTargets.filter((target) => Boolean(target.url));
const activeCostcoCaTargets = costcoCaTargets.filter((target) => Boolean(target.url));

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

async function parseCostcoPrice(page: any): Promise<number | null> {
  const selectors = [
    "[automation-id='productPriceOutput']",
    ".price-item--price",
    ".your-price .value"
  ];

  for (const selector of selectors) {
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

async function scrapeCostcoPlatform(
  session: BrowserSession,
  platform: "Costco_US" | "Costco_CA",
  targets: CostcoTarget[]
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
          (await page.locator("h1").first().textContent().catch(() => ""))?.trim() ?? `Unknown ${platform} Item`;
        const price = await parseCostcoPrice(page);
        const stockText = (await page.textContent("body").catch(() => ""))?.toLowerCase() ?? "";

        if (!price) {
          logger.warn("Costco price not found", { url: target.url, platform });
          return null;
        }

        return {
          model: target.hintModel ?? "M4_Pro",
          platform,
          title,
          price,
          currency,
          url: target.url,
          inStock: !/out of stock|sold out|unavailable/.test(stockText),
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
      continue;
    }
  }

  return results;
}

export async function scrapeCostcoUs(session: BrowserSession): Promise<ScrapeRecord[]> {
  if (activeCostcoUsTargets.length === 0) {
    logger.warn("Costco US targets missing. Check COSTCO_US_* secrets.");
  }
  return scrapeCostcoPlatform(session, "Costco_US", activeCostcoUsTargets);
}

export async function scrapeCostcoCa(session: BrowserSession): Promise<ScrapeRecord[]> {
  if (activeCostcoCaTargets.length === 0) {
    logger.warn("Costco CA targets missing. Check COSTCO_CA_* secrets.");
  }
  return scrapeCostcoPlatform(session, "Costco_CA", activeCostcoCaTargets);
}
