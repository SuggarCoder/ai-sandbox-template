import type { Platform } from "../types";

type SourceEnv = "AMAZON" | "COSTCO_US" | "COSTCO_CA" | "MICROCENTER";

type SourceTarget = {
  platform: Platform;
  url: string;
};

const platformFromEnv: Record<SourceEnv, Platform> = {
  AMAZON: "Amazon",
  COSTCO_US: "Costco_US",
  COSTCO_CA: "Costco_CA",
  MICROCENTER: "Microcenter"
};

function toAmazonUrl(entry: string): string {
  if (/^https?:\/\//i.test(entry)) {
    return entry;
  }

  return `https://www.amazon.com/dp/${entry}`;
}

function normalizeEntry(source: SourceEnv, entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    return "";
  }

  if (source === "AMAZON") {
    return toAmazonUrl(trimmed);
  }

  return trimmed;
}

export function getSourceTargets(source: SourceEnv): SourceTarget[] {
  const raw = process.env[source] ?? "";
  const parts = raw.split(",").map((part) => normalizeEntry(source, part)).filter(Boolean);

  return parts.map((url) => ({
    platform: platformFromEnv[source],
    url
  }));
}
