/**
 * Where «مسیریابی» on a salon or artist page sends the client. Every link is a plain web address that
 * opens the app when it is installed (Android hands it over from the frfro app shell too) and the
 * website when it is not; the client's own position is the start, so only the destination is sent.
 *
 * Snapp publishes no link that fills in the destination, so «اسنپ» copies the address first
 * (LocationButton) and opens Snapp; the client pastes it as the destination there.
 *
 * Tapsi does take one: `tap30://ride/?saddr=lat,lng&daddr=lat,lng` is what Balad hands Tapsi from its
 * own «تاکسی اینترنتی» tab, and it opens Tapsi's car choice with both ends filled and the prices shown
 * (read from Balad 4.85.1 → Tapsi 8.5.0 on an Android phone, 2026-10-20). It is not documented, so
 * LocationButton tells the client what to do if Tapsi does not open. Android only for now: Tapsi is not
 * in Iran's App Store, and whether the iPhone builds (Sibche, Anardoni) take the link is not tested yet.
 * Everywhere else «تپسی» works like «اسنپ»: the address is copied and Tapsi's web app opens.
 */
export const SNAPP_URL = "https://app.snapp.taxi/";
export const TAPSI_SITE_URL = "https://tapsi.ir/";
/** Tapsi's own web app, linked from tapsi.ir as «نسخه وب تپسی». */
export const TAPSI_WEB_URL = "https://app.tapsi.cab/";
// Once a real iPhone opens Tapsi on the ride from `tap30://ride/…`, add "ios" here.
const TAPSI_RIDE_PLATFORMS = ["android"];

function hasPin(location) {
  return Number.isFinite(location?.lat) && Number.isFinite(location?.lng);
}

/** «تهران، یوسف‌آباد، …، پلاک ۸، طبقه ۲»: what the copy button and Snapp get. */
export function fullAddress(location) {
  if (!location) return "";
  return [location.address, location.detail].map((part) => String(part || "").trim()).filter(Boolean).join("، ");
}

function point({ lat, lng }) {
  return `${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`;
}

/**
 * «درخواست تپسی»: Tapsi opens on the ride to the salon. `origin` is the client's own position when the
 * page already has it; without it Tapsi asks the client to confirm where they are first.
 */
export function tapsiLink(location, origin = null) {
  if (!hasPin(location)) return "";
  const from = hasPin(origin) ? `saddr=${point(origin)}&` : "";
  return `tap30://ride/?${from}daddr=${point(location)}`;
}

/** The ride link on phones whose Tapsi takes it; "" means copy the address and open `TAPSI_WEB_URL`. */
export function tapsiRideLink(location, platform = "", origin = null) {
  return TAPSI_RIDE_PLATFORMS.includes(platform) ? tapsiLink(location, origin) : "";
}

/**
 * The navigation apps for one location, in the order they are shown. Without a pin only Google Maps
 * can help (it searches the address text); Balad and Neshan need the point.
 * `platform` is "android" | "ios" | "" and adds the phone's own map chooser / Apple Maps.
 */
export function navigationLinks(location, platform = "") {
  if (!location) return [];
  const links = [];
  if (hasPin(location)) {
    const lat = Number(location.lat.toFixed(6));
    const lng = Number(location.lng.toFixed(6));
    links.push(
      { id: "google", label: "گوگل مپ", href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
      { id: "balad", label: "بلد", href: `https://balad.ir/location?latitude=${lat}&longitude=${lng}&zoom=17` },
      { id: "neshan", label: "نشان", href: `https://nshn.ir/?lat=${lat}&lng=${lng}` }
    );
    if (platform === "android") {
      // Android's own chooser: every map app on the phone (Waze, …) that is not listed above.
      links.push({ id: "other", label: "برنامه‌های دیگر", href: `geo:${lat},${lng}?q=${lat},${lng}` });
    } else if (platform === "ios") {
      links.push({ id: "apple", label: "اپل مپ", href: `https://maps.apple.com/?daddr=${lat},${lng}` });
    }
    return links;
  }
  const text = fullAddress(location);
  if (text) {
    links.push({ id: "google", label: "گوگل مپ", href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` });
  }
  return links;
}

/** "android" | "ios" | "" from the browser's user agent. */
export function detectPlatform(userAgent = "") {
  const ua = String(userAgent);
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "";
}
