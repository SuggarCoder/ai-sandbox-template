import { assertRuntimeEnv, getCronNote, logger } from "./config";
import { collectPriceRecords } from "./scraper";
import { upsertPriceRecords } from "./supabase";

async function main() {
  assertRuntimeEnv();

  logger.info("Price monitor started", { cron: getCronNote() });

  const records = await collectPriceRecords(logger);
  const result = await upsertPriceRecords(records);

  logger.info("Price monitor finished", {
    inserted: result.inserted,
    acceptedThresholdUsd: 2300
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("Price monitor failed", { message });
  process.exitCode = 1;
});
