import type { Logger } from "./types";

const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export const CAD_TO_USD = Number(process.env.CAD_TO_USD ?? "0.74");

export function assertRuntimeEnv() {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }
}

export function getCronNote() {
  return "GitHub Actions cron(UTC): 0 0,6,12,18 * * *";
}

export const logger: Logger = {
  info(message, meta) {
    console.log(JSON.stringify({ level: "info", message, ...meta }));
  },
  warn(message, meta) {
    console.warn(JSON.stringify({ level: "warn", message, ...meta }));
  },
  error(message, meta) {
    console.error(JSON.stringify({ level: "error", message, ...meta }));
  }
};
