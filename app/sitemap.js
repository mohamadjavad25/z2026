import { ensureDb } from "./lib/db/connection.js";
import { listSalons } from "./lib/db/repos/salons.js";
import { listArtists } from "./lib/db/repos/artists.js";
import { listShops } from "./lib/db/repos/shops.js";

// The DB layer uses node:sqlite (a Node.js builtin), same as
// app/salons/[id]/page.jsx etc. — must not run on the Edge runtime.
export const runtime = "nodejs";

// TODO(founder): no production domain is defined anywhere in the codebase yet
// (no NEXT_PUBLIC_SITE_URL env var, no next.config.mjs entry, no
// metadataBase in app/layout.jsx). This is a placeholder — replace it with
// the real zibaban production domain before/at deploy, otherwise every URL
// submitted to Google will point at this fake address.
const SITE_URL = "https://zibaban.example.com";

export default function sitemap() {
  ensureDb();

  const staticEntries = [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1
    }
  ];

  // listShops() already filters to isPublic shops only (see the docstring on
  // that function in app/lib/db/repos/shops.js) — a shop switched to
  // "خصوصی" must not leak its URL into the sitemap even though its page now
  // correctly 404s for it.
  const salonEntries = listSalons().map((salon) => ({
    url: `${SITE_URL}/salons/${salon.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8
  }));

  const artistEntries = listArtists().map((artist) => ({
    url: `${SITE_URL}/artists/${artist.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8
  }));

  const shopEntries = listShops().map((shop) => ({
    url: `${SITE_URL}/shops/${shop.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8
  }));

  return [...staticEntries, ...salonEntries, ...artistEntries, ...shopEntries];
}
