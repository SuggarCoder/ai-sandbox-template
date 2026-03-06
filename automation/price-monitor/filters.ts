import { toUsd } from "./fx";
import type { NormalizedRecord, ScrapeRecord } from "./types";

const m4Pattern = /\bm4\s*pro\b/i;
const m5ProPattern = /\bm5\s*pro\b/i;
const m5Pattern = /\bm5\b/i;

function inferModel(title: string) {
  if (m4Pattern.test(title)) {
    return "M4_Pro" as const;
  }

  if (m5ProPattern.test(title)) {
    return "M5_Pro" as const;
  }

  if (m5Pattern.test(title)) {
    return "M5" as const;
  }

  return "M5_Pro" as const;
}

export function normalizeAndFilter(records: ScrapeRecord[]): NormalizedRecord[] {
  return records.map((record) => ({
    ...record,
    model: inferModel(record.title),
    priceUsd: toUsd(record.price, record.currency)
  }));
}
