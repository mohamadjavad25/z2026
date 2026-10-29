// Every external host this app actually talks to from the browser, grepped
// directly out of app/features/** rather than guessed -- a CSP built from a
// guess either blocks something real (map tiles, Nominatim reverse-geocoding)
// or is too loose to matter. Fonts (styles/fonts.css) and Leaflet's CSS are
// served from this site, so no font or stylesheet host is allowed.
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
// A bank gateway that needs a posted form (most redirect with a GET and need nothing here) lists its bank's origin
// in FRFRO_PAYMENT_FORM_HOSTS (comma separated, https only): the browser may then post the payment form to it.
// See app/lib/payments/index.js.
function paymentFormHosts() {
  return String(process.env.FRFRO_PAYMENT_FORM_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(host));
}

function buildCsp() {
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'"],
    "img-src": ["'self'", "data:", "https://*.tile.openstreetmap.org"],
    "connect-src": ["'self'", "https://nominatim.openstreetmap.org"],
    // blob:: a voice note just recorded in the support chat plays back before it is sent.
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...paymentFormHosts()],
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
  // camera=(self): the QR scanner (components/QrScanner.jsx) in «سالن و آرتیست من»
  // and the customers page. With camera=() the browser refused without even asking.
  // microphone=(self): voice notes in the support chat (features/support/VoiceRecorder.js).
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(self)" }
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
  // Self-hosted server (deploy/): a self-contained build folder. Vercel never sets this, so its build is unchanged.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  // connection.js reads the DB CA at runtime via PGSSL_CA_PATH; make sure
  // the file is traced into every serverless function that touches the DB.
  outputFileTracingIncludes: { "/**": ["./certs/**"] },
  // The site's own domain is frfro.ir; the old Vercel address sends visitors
  // there so shared links and QR codes always carry frfro.ir. /api/ is left
  // alone so anything still calling the old address (e.g. the GitHub Actions
  // cron, whose APP_URL secret may still point at it) keeps working.
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "z2026.vercel.app" }],
        destination: "https://frfro.ir/:path",
        permanent: true
      },
      // www.frfro.ir and the Persian domain فرفرو.ir (punycode xn--wgba0cb0b.ir), once added
      // to the Vercel project, land on frfro.ir: one address, so search engines rank one site.
      ...["www.frfro.ir", "xn--wgba0cb0b.ir", "www.xn--wgba0cb0b.ir"].map((host) => ({
        source: "/:path*",
        has: [{ type: "host", value: host }],
        destination: "https://frfro.ir/:path*",
        permanent: true
      }))
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        // The Android app (built from mobile/, see mobile/README.md). Short cache so a new
        // version reaches people within minutes of being deployed.
        source: "/download/frfro.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: "attachment; filename=\"frfro.apk\"" },
          { key: "Cache-Control", value: "public, max-age=300" }
        ]
      },
      {
        // Admin pages and API are never cached by browsers or proxies.
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }]
      }
    ];
  }
};

export default nextConfig;
