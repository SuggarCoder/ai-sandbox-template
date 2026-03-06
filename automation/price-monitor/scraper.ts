import { normalizeAndFilter } from "./filters";
import { scrapeCostcoUs } from "./scrapers/costco";
import { scrapeMicrocenter } from "./scrapers/microcenter";
import { createBrowserSession } from "./scrapers/playwright-runtime";
import type { Logger, NormalizedRecord } from "./types";

export async function collectPriceRecords(logger: Logger): Promise<NormalizedRecord[]> {
  const session = await createBrowserSession();

  try {
    const settled = await Promise.allSettled([scrapeCostcoUs(session), scrapeMicrocenter(session)]);

    const [costcoUsResult, microcenterResult] = settled;
    const costcoUs = costcoUsResult.status === "fulfilled" ? costcoUsResult.value : [];
    const microcenter = microcenterResult.status === "fulfilled" ? microcenterResult.value : [];

    if (costcoUsResult.status === "rejected") {
      logger.warn("Costco US scrape failed, continue with other platforms", {
        reason: costcoUsResult.reason instanceof Error ? costcoUsResult.reason.message : "Unknown"
      });
    }

    if (microcenterResult.status === "rejected") {
      logger.warn("Microcenter scrape failed, continue with other platforms", {
        reason: microcenterResult.reason instanceof Error ? microcenterResult.reason.message : "Unknown"
      });
    }

    const all = [...costcoUs, ...microcenter];
    const normalized = normalizeAndFilter(all);

    logger.info("Scrape completed", {
      costcoUsCount: costcoUs.length,
      microcenterCount: microcenter.length,
      rawCount: all.length,
      normalizedCount: normalized.length
    });

    return normalized;
  } finally {
    await session.close();
  }
}
