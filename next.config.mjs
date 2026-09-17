const nextConfig = {
  // "*.*.*.*" allows any IPv4 host (e.g. your PC's address on a phone
  // hotspot / home Wi-Fi) to load the dev server from another device on
  // the same network, without hardcoding one specific IP that changes
  // between networks. Dev-only setting — has no effect on `next build`.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.*.*.*"],
  transpilePackages: ["react-7-segment-display"],
  // Isolated smoke tests set NEXT_DIST_DIR so a second `next dev` does not collide with the main lock.
  distDir: process.env.NEXT_DIST_DIR || ".next"
};

export default nextConfig;
