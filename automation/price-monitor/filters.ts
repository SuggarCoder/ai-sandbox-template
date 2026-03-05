import { MAX_PRICE_USD } from "./config";
import { toUsd } from "./fx";
import type { Model, NormalizedRecord, ScrapeRecord } from "./types";

const m4Pattern = /\bm4\s*pro\b/i;
const m5Pattern = /\bm5\s*pro\b/i;

export function inferModel(title: string, fallback?: Model): Model | null {
  if (m4Pattern.test(title)) {
    return "M4_Pro";
  }

  if (m5Pattern.test(title)) {
    return "M5_Pro";
  }

  return fallback ?? null;
}

export function normalizeAndFilter(records: ScrapeRecord[]): NormalizedRecord[] {
  return records
    .map((record) => {
      const model = inferModel(record.title, record.model);
      if (!model) {
        return null;
      }

      const priceUsd = toUsd(record.price, record.currency);
      if (priceUsd > MAX_PRICE_USD) {
        return null;
      }

      return {
        ...record,
        model,
        priceUsd
      };
    })
    .filter((record): record is NormalizedRecord => Boolean(record));
}
