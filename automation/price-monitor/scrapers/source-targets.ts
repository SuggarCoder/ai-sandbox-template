import type { Platform } from "../types";

type SourceEnv = "COSTCO_US" | "COSTCO_CA" | "MICROCENTER";

type SourceTarget = {
  platform: Platform;
  url: string;
};

const platformFromEnv: Record<SourceEnv, Platform> = {
  COSTCO_US: "Costco_US",
  COSTCO_CA: "Costco_CA",
  MICROCENTER: "Microcenter"
};

function normalizeEntry(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed;
}

export function getSourceTargets(source: SourceEnv): SourceTarget[] {
  const raw = process.env[source] ?? "";
  const parts = raw.split(",").map((part) => normalizeEntry(part)).filter(Boolean);

  return parts.map((url) => ({
    platform: platformFromEnv[source],
    url
  }));
}
