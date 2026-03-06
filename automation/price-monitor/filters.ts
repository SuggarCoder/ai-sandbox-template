import { MAX_PRICE_USD } from "./config";
import { toUsd } from "./fx";
import type { NormalizedRecord, ScrapeRecord } from "./types";

const m4Pattern = /\bm4\s*pro\b/i;

export function normalizeAndFilter(records: ScrapeRecord[]): NormalizedRecord[] {
  return records
    .map((record) => {
      if (!m4Pattern.test(record.title)) {
        return null;
      }

      const priceUsd = toUsd(record.price, record.currency);
      if (priceUsd > MAX_PRICE_USD) {
        return null;
      }

      return {
        ...record,
        model: "M4_Pro",
        priceUsd
      };
    })
    .filter((record): record is NormalizedRecord => Boolean(record));
}
