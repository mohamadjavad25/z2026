// Single source of truth: NEXT_PUBLIC_SITE_URL (see .env.example at the repo
// root) — same variable app/sitemap.js and app/layout.jsx's metadataBase
// read, so sitemap/robots/canonical URLs can never drift from each other.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zibaban.example.com";

// robots.js itself touches no DB, but kept consistent with sitemap.js/the
// rest of the app (which relies on node:sqlite, a Node.js builtin).
export const runtime = "nodejs";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/salons/", "/artists/"],
        // /api/* are server endpoints (JSON, mutations, auth), not content —
        // nothing under app/api is a page meant to be indexed. Every other
        // part of the product (dashboards, profile editing, chat, booking
        // management, etc.) lives behind client-side state on "/" itself
        // rather than its own crawlable URL, so there is currently no
        // separate internal/auth-gated route to disallow beyond /api/.
        disallow: ["/api/"]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
