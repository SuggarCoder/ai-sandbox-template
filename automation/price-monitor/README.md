# MacBook Pro Price Monitor (Skeleton)

This folder contains a TypeScript skeleton for scraping and storing MacBook Pro M4 Pro / M5 Pro prices.

## Rules implemented

- Platforms: Amazon, Costco US, Costco CA
- Region hints:
  - Costco US zip: `95014`
  - Costco CA postal code: `M4Y0G7`
- Only store records where `price_usd <= 2300`
  - CAD is converted using `CAD_TO_USD` (default `0.74`)
- Anti-bot hardening:
  - `playwright-extra` + `puppeteer-extra-plugin-stealth`
  - navigation backoff + block-page detection + jitter delays

## Run locally

```bash
npm install
npm install --no-save playwright tsx
npx tsx automation/price-monitor/run.ts
```

## Required env

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CAD_TO_USD` (optional, default 0.74)
- `AMAZON_ASIN_M4_1`, `AMAZON_ASIN_M4_2`
- `AMAZON_ASIN_M5_1`, `AMAZON_ASIN_M5_2`
- `COSTCO_US_M4_URL`, `COSTCO_US_M5_URL`
- `COSTCO_CA_M4_URL`, `COSTCO_CA_M5_URL`
