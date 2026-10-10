import { toPersianDigits } from "./digits";
import { parseTomanAmount } from "./money";
import { parseServiceDurationMinutes } from "./time";

// Bookings store the service as free text, at most this long (lib/validation/booking.js).
const MAX_SERVICE_TEXT = 200;

/** Several service names as one booking's service text, kept within the stored limit. */
export function joinServiceNames(names) {
  const list = (Array.isArray(names) ? names : []).map((name) => String(name || "").trim()).filter(Boolean);
  const joined = list.join(" + ");
  return joined.length <= MAX_SERVICE_TEXT || list.length < 2
    ? joined
    : `${list[0]} + ${toPersianDigits(list.length - 1)} خدمت دیگر`;
}

/**
 * A booking's service text for one short line: several services joined with « + » become
 * "first + N خدمت دیگر". One service comes back as is.
 */
export function shortServiceLabel(service) {
  const text = String(service || "").trim();
  const names = text.split(" + ").map((name) => name.trim()).filter(Boolean);
  if (names.length < 2) return text;
  // Already shortened by joinServiceNames when the full list was too long to store.
  if (names.length === 2 && names[1].endsWith("خدمت دیگر")) return text;
  return `${names[0]} + ${toPersianDigits(names.length - 1)} خدمت دیگر`;
}

export function serviceKey(service) {
  return String(service?.id ?? service?.name ?? "");
}

/**
 * Several services the client picked for one visit, as ONE service-shaped
 * object: the services happen back to back in a single appointment, so the
 * booking gets the names joined with « + », the summed duration and the
 * summed price. One service comes back as is; none gives null.
 */
export function bundleServices(services) {
  const list = (Array.isArray(services) ? services : []).filter(Boolean);
  if (list.length < 2) return list[0] || null;
  const minutes = list.reduce((sum, service) => sum + parseServiceDurationMinutes(service.duration), 0);
  const prices = list.map((service) => parseTomanAmount(service.price));
  return {
    id: `bundle:${list.map(serviceKey).join("+")}`,
    name: joinServiceNames(list.map((service) => service.name)),
    duration: `${toPersianDigits(minutes)} دقیقه`,
    // A price only when every service has one; otherwise it is agreed at the salon.
    price: prices.every(Boolean) ? String(prices.reduce((sum, price) => sum + price, 0)) : "",
    emoji: list[0].emoji,
    items: list
  };
}
