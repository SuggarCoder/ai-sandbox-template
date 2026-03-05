import { normalizeAndFilter } from "./filters";
import { scrapeAmazon } from "./scrapers/amazon";
import { scrapeCostcoCa, scrapeCostcoUs } from "./scrapers/costco";
import { createBrowserSession } from "./scrapers/playwright-runtime";
import type { Logger, NormalizedRecord } from "./types";

export async function collectPriceRecords(logger: Logger): Promise<NormalizedRecord[]> {
  const session = await createBrowserSession();

  try {
    const [amazon, costcoUs, costcoCa] = await Promise.all([
      scrapeAmazon(session),
      scrapeCostcoUs(session),
      scrapeCostcoCa(session)
    ]);

    const all = [...amazon, ...costcoUs, ...costcoCa];
    const filtered = normalizeAndFilter(all);

    logger.info("Scrape completed", {
      rawCount: all.length,
      filteredCount: filtered.length
    });

    return filtered;
  } finally {
    await session.close();
  }
}
