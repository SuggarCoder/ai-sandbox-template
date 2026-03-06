import { normalizeAndFilter } from "./filters";
import { scrapeAmazon } from "./scrapers/amazon";
import { scrapeCostcoCa, scrapeCostcoUs } from "./scrapers/costco";
import { scrapeMicrocenter } from "./scrapers/microcenter";
import { createBrowserSession } from "./scrapers/playwright-runtime";
import type { Logger, NormalizedRecord } from "./types";

export async function collectPriceRecords(logger: Logger): Promise<NormalizedRecord[]> {
  const session = await createBrowserSession();

  try {
    const settled = await Promise.allSettled([
      scrapeAmazon(session),
      scrapeCostcoUs(session),
      scrapeCostcoCa(session),
      scrapeMicrocenter(session)
    ]);

    const [amazonResult, costcoUsResult, costcoCaResult, microcenterResult] = settled;
    const amazon = amazonResult.status === "fulfilled" ? amazonResult.value : [];
    const costcoUs = costcoUsResult.status === "fulfilled" ? costcoUsResult.value : [];
    const costcoCa = costcoCaResult.status === "fulfilled" ? costcoCaResult.value : [];
    const microcenter = microcenterResult.status === "fulfilled" ? microcenterResult.value : [];

    if (amazonResult.status === "rejected") {
      logger.warn("Amazon scrape failed, continue with other platforms", {
        reason: amazonResult.reason instanceof Error ? amazonResult.reason.message : "Unknown"
      });
    }

    if (costcoUsResult.status === "rejected") {
      logger.warn("Costco US scrape failed, continue with other platforms", {
        reason: costcoUsResult.reason instanceof Error ? costcoUsResult.reason.message : "Unknown"
      });
    }

    if (costcoCaResult.status === "rejected") {
      logger.warn("Costco CA scrape failed, continue with other platforms", {
        reason: costcoCaResult.reason instanceof Error ? costcoCaResult.reason.message : "Unknown"
      });
    }

    if (microcenterResult.status === "rejected") {
      logger.warn("Microcenter scrape failed, continue with other platforms", {
        reason: microcenterResult.reason instanceof Error ? microcenterResult.reason.message : "Unknown"
      });
    }

    const all = [...amazon, ...costcoUs, ...costcoCa, ...microcenter];
    const filtered = normalizeAndFilter(all);

    logger.info("Scrape completed", {
      amazonCount: amazon.length,
      costcoUsCount: costcoUs.length,
      costcoCaCount: costcoCa.length,
      microcenterCount: microcenter.length,
      rawCount: all.length,
      filteredCount: filtered.length
    });

    return filtered;
  } finally {
    await session.close();
  }
}
