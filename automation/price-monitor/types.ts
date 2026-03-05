export type Platform = "Amazon" | "Costco_US" | "Costco_CA";

export type Model = "M4_Pro" | "M5_Pro";

export type Currency = "USD" | "CAD";

export type ScrapeRecord = {
  model: Model;
  platform: Platform;
  title: string;
  price: number;
  currency: Currency;
  url: string;
  inStock: boolean;
  originalPrice?: number;
  scrapedAt: string;
};

export type NormalizedRecord = ScrapeRecord & {
  priceUsd: number;
};

export type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};
