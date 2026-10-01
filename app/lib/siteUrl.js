const PLACEHOLDER_SITE_URL = "https://zibaban.example.com";

/**
 * Single source of truth for the site's public domain (canonical URLs,
 * sitemap/robots entries, OpenGraph tags, metadataBase) -- every call site
 * used to repeat `process.env.NEXT_PUBLIC_SITE_URL || PLACEHOLDER`
 * independently (app/layout.jsx, app/sitemap.js, app/robots.js, and the
 * three [id] detail pages), which also meant a production deploy that
 * forgot to set this would silently ship with every canonical/OG URL
 * pointing at a fake, unreachable domain -- SEO-invisible with no error
 * anywhere. Centralizing it here means that gap now has exactly one place
 * to warn loudly about it, instead of six places to silently not.
 */
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    console.error(
      `NEXT_PUBLIC_SITE_URL is not set -- every canonical URL, sitemap entry, and OpenGraph tag will point at the placeholder domain (${PLACEHOLDER_SITE_URL}) instead of this site's real domain. Set it in your deployment's environment variables (see .env.example).`
    );
  }
  return PLACEHOLDER_SITE_URL;
}
