import { toPersianDigits } from "./digits";
import { parseTomanAmount } from "./money";
import { parseServiceDurationMinutes } from "./time";

// Bookings store the service as free text, at most this long (lib/validation/booking.js).
const MAX_SERVICE_TEXT = 200;

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
  const joined = list.map((service) => service.name).join(" + ");
  return {
    id: `bundle:${list.map(serviceKey).join("+")}`,
    name: joined.length <= MAX_SERVICE_TEXT
      ? joined
      : `${list[0].name} + ${toPersianDigits(list.length - 1)} خدمت دیگر`,
    duration: `${toPersianDigits(minutes)} دقیقه`,
    // A price only when every service has one; otherwise it is agreed at the salon.
    price: prices.every(Boolean) ? String(prices.reduce((sum, price) => sum + price, 0)) : "",
    emoji: list[0].emoji,
    items: list
  };
}
