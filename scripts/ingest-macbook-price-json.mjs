import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const REQUIRED_FIELDS = ["platform", "region", "model", "spec", "price", "url"];
const PRICE_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function parseArgs(argv) {
  const args = {
    file: null,
    validateOnly: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--validate-only") {
      args.validateOnly = true;
      continue;
    }

    if (!args.file) {
      args.file = token;
      continue;
    }

    throw new Error(`Unexpected argument: ${token}`);
  }

  return args;
}

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readInput(file) {
  if (file) {
    return readFile(file, "utf8");
  }

  const payload = await readStdin();
  if (!payload.trim()) {
    throw new Error("Missing input JSON. Provide a file path or pipe JSON array through stdin.");
  }

  return payload;
}

function requireRuntimeEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }
}

function getSupabase() {
  requireRuntimeEnv();

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function normalizeString(value, field, index) {
  if (typeof value !== "string") {
    throw new Error(`Item ${index} field "${field}" must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Item ${index} field "${field}" cannot be empty.`);
  }

  return trimmed;
}

function validateRecordKeys(record, index) {
  const keys = Object.keys(record).sort();
  const expected = [...REQUIRED_FIELDS].sort();

  if (keys.length !== expected.length || keys.some((key, keyIndex) => key !== expected[keyIndex])) {
    throw new Error(`Item ${index} must contain exactly these fields: ${REQUIRED_FIELDS.join(", ")}.`);
  }
}

function parsePrice(rawPrice, index) {
  const normalized = normalizeString(rawPrice, "price", index);

  if (!PRICE_PATTERN.test(normalized)) {
    throw new Error(`Item ${index} field "price" must contain digits with an optional decimal point.`);
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Item ${index} field "price" must be greater than 0.`);
  }

  return normalized.includes(".") ? numeric.toFixed(2) : `${numeric.toFixed(2)}`;
}

function parsePayload(rawInput) {
  let parsed;

  try {
    parsed = JSON.parse(rawInput);
  } catch (error) {
    throw new Error(`Invalid JSON input: ${error instanceof Error ? error.message : "Unknown parse error"}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Input must be a JSON array.");
  }

  const seenUrls = new Set();

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Item ${index} must be a JSON object.`);
    }

    validateRecordKeys(item, index);

    const record = {
      platform: normalizeString(item.platform, "platform", index),
      region: normalizeString(item.region, "region", index),
      model: normalizeString(item.model, "model", index),
      spec: normalizeString(item.spec, "spec", index),
      price: parsePrice(item.price, index),
      url: normalizeString(item.url, "url", index)
    };

    if (seenUrls.has(record.url)) {
      throw new Error(`Duplicate url found in input: ${record.url}`);
    }

    seenUrls.add(record.url);
    return record;
  });
}

async function syncProducts(supabase, records) {
  const urls = records.map((record) => record.url);

  const { data: existingProducts, error: selectError } = await supabase
    .from("products")
    .select("id, model, specs, platform, region, url")
    .in("url", urls);

  if (selectError) {
    throw new Error(`Failed to load existing products: ${selectError.message}`);
  }

  const existingByUrl = new Map((existingProducts ?? []).map((product) => [product.url, product]));

  const insertRows = records
    .filter((record) => !existingByUrl.has(record.url))
    .map((record) => ({
      id: randomUUID(),
      model: record.model,
      specs: record.spec,
      platform: record.platform,
      region: record.region,
      url: record.url
    }));

  if (insertRows.length > 0) {
    const { error: insertError } = await supabase.from("products").insert(insertRows);

    if (insertError) {
      throw new Error(`Failed to insert products: ${insertError.message}`);
    }
  }

  const updateTargets = records.filter((record) => {
    const existing = existingByUrl.get(record.url);

    return (
      existing &&
      (existing.model !== record.model ||
        existing.specs !== record.spec ||
        existing.platform !== record.platform ||
        existing.region !== record.region)
    );
  });

  for (const record of updateTargets) {
    const existing = existingByUrl.get(record.url);

    const { error: updateError } = await supabase
      .from("products")
      .update({
        model: record.model,
        specs: record.spec,
        platform: record.platform,
        region: record.region
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update product for ${record.url}: ${updateError.message}`);
    }
  }

  const { data: allProducts, error: refetchError } = await supabase
    .from("products")
    .select("id, url")
    .in("url", urls);

  if (refetchError) {
    throw new Error(`Failed to reload products: ${refetchError.message}`);
  }

  return new Map((allProducts ?? []).map((product) => [product.url, product.id]));
}

async function buildPriceHistoryRows(supabase, records, productIdsByUrl) {
  const capturedAt = new Date().toISOString();
  const rows = [];

  for (const record of records) {
    const productId = productIdsByUrl.get(record.url);
    if (!productId) {
      throw new Error(`Missing product_id for url: ${record.url}`);
    }

    const { data: latestRows, error: latestError } = await supabase
      .from("price_history")
      .select("price, captured_at")
      .eq("product_id", productId)
      .order("captured_at", { ascending: false })
      .limit(1);

    if (latestError) {
      throw new Error(`Failed to load latest price history for ${record.url}: ${latestError.message}`);
    }

    const latestPrice = latestRows?.[0]?.price;
    const nextPrice = Number(record.price).toFixed(2);

    if (latestPrice !== null && latestPrice !== undefined && Number(latestPrice).toFixed(2) === nextPrice) {
      continue;
    }

    rows.push({
      product_id: productId,
      price: nextPrice,
      captured_at: capturedAt
    });
  }

  return rows;
}

async function insertPriceHistoryRows(supabase, rows) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("price_history").insert(rows);
  if (error) {
    throw new Error(`Failed to insert price history rows: ${error.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawInput = await readInput(args.file);
  const records = parsePayload(rawInput);

  if (args.validateOnly) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, validated: records.length, mode: "validate-only" }, null, 2)}\n`
    );
    return;
  }

  const supabase = getSupabase();
  const productIdsByUrl = await syncProducts(supabase, records);
  const priceHistoryRows = await buildPriceHistoryRows(supabase, records, productIdsByUrl);
  await insertPriceHistoryRows(supabase, priceHistoryRows);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        received: records.length,
        productsSynced: productIdsByUrl.size,
        priceHistoryInserted: priceHistoryRows.length,
        priceHistorySkipped: records.length - priceHistoryRows.length
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
});
