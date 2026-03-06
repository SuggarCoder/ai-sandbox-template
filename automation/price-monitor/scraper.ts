import { normalizeAndFilter } from "./filters";
import { scrapeCostcoCa, scrapeCostcoUs } from "./scrapers/costco";
import { scrapeMicrocenter } from "./scrapers/microcenter";
import { createBrowserSession } from "./scrapers/playwright-runtime";
import type { Logger, NormalizedRecord } from "./types";

export async function collectPriceRecords(logger: Logger): Promise<NormalizedRecord[]> {
  const session = await createBrowserSession();

  try {
    const settled = await Promise.allSettled([
      scrapeCostcoUs(session),
      scrapeCostcoCa(session),
      scrapeMicrocenter(session)
    ]);

    const [costcoUsResult, costcoCaResult, microcenterResult] = settled;
    const costcoUs = costcoUsResult.status === "fulfilled" ? costcoUsResult.value : [];
    const costcoCa = costcoCaResult.status === "fulfilled" ? costcoCaResult.value : [];
    const microcenter = microcenterResult.status === "fulfilled" ? microcenterResult.value : [];

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

    const all = [...costcoUs, ...costcoCa, ...microcenter];
    const filtered = normalizeAndFilter(all);

    logger.info("Scrape completed", {
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
