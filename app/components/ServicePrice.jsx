import { servicePriceText } from "../shared/lib/money";

/** A service's price in a list, its unit small; `fallback` when none was written. */
export function ServicePrice({ price, fallback = "قیمت توافقی" }) {
  const text = servicePriceText(price);
  if (!text) return fallback ? <small>{fallback}</small> : null;
  const parts = text.match(/^(.*) (تومان|تومن)$/);
  return parts ? <>{parts[1]} <small>{parts[2]}</small></> : text;
}
