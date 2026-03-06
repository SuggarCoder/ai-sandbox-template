# MacBook Pro Price Monitor (Skeleton)

This folder contains a TypeScript skeleton for scraping and storing MacBook Pro prices.

## Rules implemented

- Platforms: Costco US, Microcenter
- Region hints:
  - Costco US zip: `95014`
- No model/price gate before insert:
  - Any configured source URL result is eligible for insert
  - `model` is inferred from title (`M4 Pro` / `M5` / `M5 Pro`), fallback `UNKNOWN`
  - CAD is converted using `CAD_TO_USD` (default `0.74`) for `price_usd` field
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
- `COSTCO_US`
- `MICROCENTER`

Each source variable accepts comma-separated URLs.
