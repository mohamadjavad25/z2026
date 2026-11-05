/**
 * The footprint, phone side: which screens opened and which main actions happened, sent in small batches to
 * /api/activity (docs/PROJECT_NOTES.md «رد پا»). Only fixed names go out: nothing the person typed, no photo, no place.
 * Never throws and never waits on anything, so it can sit on any button.
 */
const VISITOR_KEY = "frfro-visitor";
const VISIT_KEY = "frfro-visit";
const VISIT_GAP_MS = 30 * 60 * 1000; // away this long = a new visit
const SEND_EVERY_MS = 30 * 1000;
const PING_EVERY_MS = 60 * 1000; // while the screen is on, so «رفت» is right to the minute
const MAX_QUEUE = 40;

let started = false;
let visitorId = "";
let visit = null;
let source = "";
let queue = [];
let lastScreen = "";
let lastSent = 0;

const inBrowser = () => typeof window !== "undefined";

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode: this visit still counts, the next one looks new
  }
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`.slice(0, 40);
}

function saveVisit() {
  write(VISIT_KEY, JSON.stringify(visit));
}

function beginVisit() {
  visit = { id: makeId(), last: Date.now() };
  lastScreen = "";
  saveVisit();
}

function restoreVisit() {
  try {
    const saved = JSON.parse(read(VISIT_KEY) || "null");
    if (saved?.id && Date.now() - saved.last < VISIT_GAP_MS) {
      visit = saved;
      return;
    }
  } catch {
    // a broken saved visit is just a new visit
  }
  beginVisit();
}

/** Where this visit came from: a link's own tag, or the site before this one. */
function readSource() {
  try {
    const params = new URLSearchParams(window.location.search);
    let found = params.get("utm_source") || "";
    if (!found && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host !== window.location.hostname) found = host;
    }
    return found.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 40);
  } catch {
    return "";
  }
}

function send({ leaving = false } = {}) {
  if (!started || !visit) return;
  const now = Date.now();
  const events = queue.map(({ k, n, p, at }) => ({ k, n, ...(p ? { p } : {}), ago: Math.min(Math.max(now - at, 0), 3_600_000) }));
  queue = [];
  lastSent = now;
  visit.last = now;
  saveVisit();
  const body = JSON.stringify({ visitor: visitorId, visit: visit.id, ...(source ? { source } : {}), events });
  try {
    if (leaving && navigator.sendBeacon) {
      navigator.sendBeacon("/api/activity", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // the footprint must never break the page
  }
}

function add(k, n, p) {
  if (!inBrowser()) return;
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ k, n, p: Number.isInteger(p) && p > 0 && p <= 2147483647 ? p : undefined, at: Date.now() });
}

/** A screen opened. `profile` = whose public page this is. The same screen twice in a row counts once. */
export function trackScreen(name, profile) {
  const key = `${name}:${profile || ""}`;
  if (key === lastScreen) return;
  lastScreen = key;
  add("screen", name, profile);
}

/** A main action happened. */
export function trackAction(name, profile) {
  add("action", name, profile);
}

/** Signing in or out ends the visit, so two people on one phone never share a visit. */
export function endActivityVisit() {
  if (!started) return;
  send();
  beginVisit();
}

/** The account is gone: this phone starts over as a stranger, so a new account here cannot claim anything old. */
export function forgetActivityPhone() {
  if (!started) return;
  queue = [];
  visitorId = makeId();
  write(VISITOR_KEY, visitorId);
  beginVisit();
}

/** Once per page load, from the root layout. The admin panel is not part of anyone's footprint. */
export function startActivity() {
  if (started || !inBrowser() || window.location.pathname.startsWith("/admin")) return;
  started = true;
  visitorId = read(VISITOR_KEY) || makeId();
  write(VISITOR_KEY, visitorId);
  restoreVisit();
  source = readSource();
  window.setTimeout(send, 1500); // after the page has had its turn
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const due = Date.now() - lastSent;
    if ((queue.length && due >= SEND_EVERY_MS) || due >= PING_EVERY_MS) send();
  }, 10 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      send({ leaving: true });
    } else if (Date.now() - visit.last >= VISIT_GAP_MS) {
      beginVisit();
      source = "";
      send();
    }
  });
  window.addEventListener("pagehide", () => send({ leaving: true }));
}
