// Every external host this app actually talks to from the browser, grepped
// directly out of app/features/** rather than guessed -- a CSP built from a
// guess either blocks something real (Leaflet's CSS from unpkg, map tiles,
// Nominatim reverse-geocoding, Google Fonts) or is too loose to matter.
// Update this list (and the policy below) if a new external host is ever
// added -- an unlisted host just silently fails client-side, which is easy
// to miss without checking the browser console.
//
// 'unsafe-inline' is needed for both script-src (Next.js's own hydration
// data scripts and the sw-register inline <Script> in app/layout.jsx) and
// style-src (this app uses React inline style={{...}} extensively, e.g.
// portfolio tile background-images) -- a nonce-based strict CSP would
// remove the need for this but requires per-request middleware this app
// doesn't have yet; this is the pragmatic middle ground over no CSP at all.
//
// Once the Supabase Storage cutover (see app/lib/storage.js, DEVLOG) ever
// switches image reads from /api/media/* (same-origin) to Storage's own
// public URLs, img-src will need that Storage domain added too.
function buildCsp() {
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "https://*.tile.openstreetmap.org"],
    "connect-src": ["'self'", "https://nominatim.openstreetmap.org"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"]
  };
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  // Belt-and-suspenders with CSP's own frame-ancestors 'none' above --
  // older browsers that don't support frame-ancestors still get this.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation=(self): the map-based location picker
  // (ProfileLocationSettings.jsx) uses navigator.geolocation.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" }
];

if (process.env.NODE_ENV === "production") {
  // Only sent in production -- in dev this could get cached by a browser
  // against http://localhost and then refuse to load the dev server again
  // without manually clearing it.
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  });
}

const nextConfig = {
  // "*.*.*.*" allows any IPv4 host (e.g. your PC's address on a phone
  // hotspot / home Wi-Fi) to load the dev server from another device on
  // the same network, without hardcoding one specific IP that changes
  // between networks. Dev-only setting — has no effect on `next build`.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.*.*.*"],
  // Isolated smoke tests set NEXT_DIST_DIR so a second `next dev` does not collide with the main lock.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // connection.js reads the DB CA at runtime via PGSSL_CA_PATH; make sure
  // the file is traced into every serverless function that touches the DB.
  outputFileTracingIncludes: { "/**": ["./certs/**"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
