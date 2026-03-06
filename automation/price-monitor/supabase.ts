import { getServerSupabase } from "@/lib/supabase/server";

import type { NormalizedRecord } from "./types";

type PriceInsertRow = {
  model: "M4_Pro" | "M5_Pro";
  platform: "Amazon" | "Costco_US" | "Costco_CA" | "Microcenter";
  title: string;
  price: number;
  price_usd: number;
  currency: "USD" | "CAD";
  original_price: number | null;
  in_stock: boolean;
  url: string;
  scraped_at: string;
};

function toInsertRows(records: NormalizedRecord[]): PriceInsertRow[] {
  return records.map((record) => ({
    model: record.model,
    platform: record.platform,
    title: record.title,
    price: record.price,
    price_usd: record.priceUsd,
    currency: record.currency,
    original_price: record.originalPrice ?? null,
    in_stock: record.inStock,
    url: record.url,
    scraped_at: record.scrapedAt
  }));
}

export async function upsertPriceRecords(records: NormalizedRecord[]) {
  if (records.length === 0) {
    return { inserted: 0 };
  }

  const supabase = getServerSupabase({ useServiceRole: true });
  const rows = toInsertRows(records);

  const { error } = await supabase
    .from("price_records")
    .upsert(rows, { onConflict: "platform,model,url,scraped_at", ignoreDuplicates: true });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return { inserted: rows.length };
}
