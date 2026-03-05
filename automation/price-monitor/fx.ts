import { CAD_TO_USD } from "./config";
import type { Currency } from "./types";

export function toUsd(price: number, currency: Currency): number {
  if (currency === "USD") {
    return price;
  }

  return Number((price * CAD_TO_USD).toFixed(2));
}
