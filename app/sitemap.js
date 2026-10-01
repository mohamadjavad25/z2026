import { ensureDb } from "./lib/db/connection.js";
import { listSalons } from "./lib/db/repos/salons.js";
import { listArtists } from "./lib/db/repos/artists.js";
import { getSiteUrl } from "./lib/siteUrl.js";

// The DB layer uses the `pg` package (a real TCP/TLS Postgres client), same
// as app/salons/[id]/page.jsx etc. — must not run on the Edge runtime.
export const runtime = "nodejs";

// Force this to render per-request instead of at build time: the DB
// connection string is a Vercel "sensitive" env var, which is only exposed
// to running functions, never to the build step — a static/prerendered
// sitemap would fail every production build. A per-request sitemap is also
// the more correct behavior anyway, since salons/artists change over time.
export const dynamic = "force-dynamic";

// Single source of truth: NEXT_PUBLIC_SITE_URL (see .env.example at the repo
// root). Falls back to the same placeholder as before so nothing breaks in
// dev/CI without env setup — but set this in production, otherwise every URL
// submitted to Google will point at this fake address (getSiteUrl() logs a
// console.error in production if this was forgotten).
const SITE_URL = getSiteUrl();

export default async function sitemap() {
  await ensureDb();

  const staticEntries = [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1
    }
  ];

  const salons = await listSalons();
  const salonEntries = salons.map((salon) => ({
    url: `${SITE_URL}/salons/${salon.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8
  }));

  const artists = await listArtists();
  const artistEntries = artists.map((artist) => ({
    url: `${SITE_URL}/artists/${artist.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8
  }));

  return [...staticEntries, ...salonEntries, ...artistEntries];
}
