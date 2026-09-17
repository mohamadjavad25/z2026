// See the TODO in app/sitemap.js — same placeholder domain, same caveat.
const SITE_URL = "https://zibaban.example.com";

// robots.js itself touches no DB, but kept consistent with sitemap.js/the
// rest of the app (which relies on node:sqlite, a Node.js builtin).
export const runtime = "nodejs";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/salons/", "/artists/", "/shops/"],
        // /api/* are server endpoints (JSON, mutations, auth), not content —
        // nothing under app/api is a page meant to be indexed. Every other
        // part of the product (dashboards, profile editing, wallet, chat,
        // booking management, etc.) lives behind client-side state on "/"
        // itself rather than its own crawlable URL, so there is currently no
        // separate internal/auth-gated route to disallow beyond /api/.
        disallow: ["/api/"]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
