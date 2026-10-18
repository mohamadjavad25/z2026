/**
 * The «کجاست؟» shape of a salon or artist on their public page: the address text (users.area),
 * the part a map cannot know (plate, floor, unit: users.address_detail) and the map pin
 * (users.geo_lat / geo_lng, null when they have not set one yet). null when there is nothing to show.
 */
export function publicLocation(row) {
  if (!row) return null;
  const address = String(row.area || "").trim();
  const detail = String(row.address_detail || "").trim();
  const lat = row.geo_lat == null ? null : Number(row.geo_lat);
  const lng = row.geo_lng == null ? null : Number(row.geo_lng);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);
  if (!address && !hasPin) return null;
  return {
    address,
    detail,
    lat: hasPin ? lat : null,
    lng: hasPin ? lng : null
  };
}
