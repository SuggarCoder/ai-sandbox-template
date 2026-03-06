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

async function scrapeCostcoCaPage(page: any, url: string): Promise<ScrapeRecord | null> {
  const title =
    (await page
      .locator("h1[itemprop='name'][automation-id='productName']")
      .first()
      .textContent()
      .catch(() => ""))?.trim() || "Unknown Costco_CA Item";

  await page.waitForTimeout(1200);

  let priceText =
    (await page
      .locator("span[automation-id='productPriceOutput']")
      .first()
      .textContent()
      .catch(() => ""))?.trim() || "";
  if (!priceText) {
    priceText =
      (await page.locator("[data-testid='Text_single-price-whole-value']").first().textContent().catch(() => ""))?.trim() ||
      "";
  }

  if (!priceText) {
    priceText = (await page.locator("meta[itemprop='price']").first().getAttribute("content").catch(() => "")) || "";
  }

  const price = Number(priceText.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(price) || price <= 0) {
    const snapshot = {
      finalUrl: page.url?.() ?? "",
      title,
      priceByAutomationId:
        (await page.locator("span[automation-id='productPriceOutput']").first().textContent().catch(() => ""))?.trim() || "",
      priceByTestId:
        (await page.locator("[data-testid='Text_single-price-whole-value']").first().textContent().catch(() => ""))?.trim() ||
        "",
      metaPrice: (await page.locator("meta[itemprop='price']").first().getAttribute("content").catch(() => "")) || "",
      zipcodeStatus:
        (await page.locator("[data-testid='Text_zipcode-status']").first().textContent().catch(() => ""))?.trim() || ""
    };
    logger.warn("Costco CA price not found", { url, ...snapshot });
    return null;
  }

  return {
    platform: "Costco_CA",
    title,
    price,
    currency: "CAD",
    url,
    inStock: true,
    scrapedAt: new Date().toISOString()
  };
}

async function scrapeCostcoUs(session: BrowserSession): Promise<ScrapeRecord[]> {
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
        await setZipOrPostalCode(page, "Costco_US");
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

async function scrapeCostcoCa(session: BrowserSession): Promise<ScrapeRecord[]> {
  const results: ScrapeRecord[] = [];
  if (costcoCaTargets.length === 0) {
    logger.warn("Costco CA targets missing. Check COSTCO_CA env.");
    return results;
  }

  for (const target of costcoCaTargets) {
    try {
      const row = await session.withPage(async (page) => {
        await gotoWithBackoff(page, target.url, "Costco_CA");
        await randomPause(page, 500, 1600);
        await setZipOrPostalCode(page, "Costco_CA");
        await randomPause(page, 800, 2200);
        return scrapeCostcoCaPage(page, target.url);
      });

      if (row) {
        results.push(row);
      }
    } catch (error) {
      logger.warn("Costco CA scrape target failed", {
        url: target.url,
        reason: error instanceof Error ? error.message : "Unknown"
      });
    }
  }

  return results;
}

export { scrapeCostcoUs, scrapeCostcoCa };
