/**
 * Next.js instrumentation hook (https://nextjs.org/docs/app/guides/instrumentation) —
 * register() runs exactly once, when the server process boots, before it
 * starts handling any requests. Stable (no experimental flag needed) as of
 * the Next.js version this app runs.
 *
 * Why this file exists: several app/lib modules (bookingExpirySweep.js,
 * rateLimit.js, chatEvents.js, presence.js) self-start their in-process
 * background behavior (setInterval sweeps, shared EventEmitter/Map) as a
 * side effect of being imported for the first time, guarded by a globalThis
 * flag so Next.js dev-mode module reloads never double-start them. That
 * pattern alone is NOT enough for a real production process lifecycle:
 * Next.js route handlers are only evaluated the first time a request
 * actually reaches them, not eagerly at server boot. Before this file
 * existed, bookingExpirySweep.js in particular only started once someone
 * hit /api/salon-bookings, /api/artist/bookings or /api/shop/orders — on a
 * freshly deployed/restarted server with no traffic yet (e.g. overnight,
 * or right after a deploy), a booking request or shop order that expired
 * during that gap would sit un-swept past the founder-approved 1-hour
 * window until the first matching request happened to arrive. Importing
 * these modules here for their side effects only guarantees every
 * self-starting background mechanism is actually running from the moment
 * the process boots, independent of which routes (if any) get hit first.
 *
 * Guarded to the Node.js runtime: these modules use node:sqlite, node:events
 * and Node timers, none of which exist in the Edge runtime, and this app
 * doesn't use the Edge runtime for anything that would need this hook.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./app/lib/bookingExpirySweep.js");
    await import("./app/lib/rateLimit.js");
    await import("./app/lib/chatEvents.js");
    await import("./app/lib/presence.js");
  }
}
