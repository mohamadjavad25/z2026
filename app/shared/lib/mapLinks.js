/**
 * Where «دیدن روی بلد» on a salon or artist page sends the client: Balad's page for the exact point,
 * only to see the place. No routing and no taxi buttons for now (user's decision 2026-10-21; the
 * Tapsi work is parked on `claude/tapsi-ride`). Balad needs the pin, so without one there is no link.
 */

function hasPin(location) {
  return Number.isFinite(location?.lat) && Number.isFinite(location?.lng);
}

/** «تهران، یوسف‌آباد، …، پلاک ۸، طبقه ۲»: what the copy button gets. */
export function fullAddress(location) {
  if (!location) return "";
  return [location.address, location.detail].map((part) => String(part || "").trim()).filter(Boolean).join("، ");
}

/** Balad's page showing the location's point, or "" when the location has no pin. */
export function baladLink(location) {
  if (!hasPin(location)) return "";
  const lat = Number(location.lat.toFixed(6));
  const lng = Number(location.lng.toFixed(6));
  return `https://balad.ir/location?latitude=${lat}&longitude=${lng}&zoom=17`;
}
