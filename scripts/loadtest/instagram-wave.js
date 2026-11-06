/* eslint-disable n/no-missing-import, no-undef -- k6 runs this file with its own runtime (k6 modules, __ENV) */
// Load test for the day an Instagram reel sends a crowd: the requests a visitor makes on the way to a booking.
// Run it from the owner's PC (not from the server itself and not from a cloud session), with k6:
//
//   k6 run -e BASE=https://frfro.ir scripts/loadtest/instagram-wave.js
//   k6 run -e BASE=https://frfro.ir -e PEAK=150 scripts/loadtest/instagram-wave.js     (peak requests per second)
//
// Read-only: it opens pages and reads the directory, the open hours and the SMS config. It never signs up,
// never books and never sends an SMS, so it is safe on the real server and costs no SMS credit.
//
// Per-address limits count too: from one PC every request comes from ONE address, so 429 answers are
// counted on their own ("limited") and never hide a real failure ("failed"). A real crowd is spread over many
// addresses (carrier NAT puts many phones behind one, which is its own thing to watch).
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE = (__ENV.BASE || "https://frfro.ir").replace(/\/$/, "");
const PEAK = Number(__ENV.PEAK) || 120;

const limited = new Counter("limited");
const failed = new Counter("failed");
const pageMs = new Trend("page_ms", true);
const apiMs = new Trend("api_ms", true);

export const options = {
  scenarios: {
    wave: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { target: Math.round(PEAK * 0.25), duration: "1m" },
        { target: Math.round(PEAK * 0.5), duration: "2m" },
        { target: PEAK, duration: "2m" },
        { target: PEAK, duration: "3m" },
        { target: 0, duration: "30s" }
      ]
    }
  },
  thresholds: {
    failed: ["count<50"],
    "http_req_duration{kind:api}": ["p(95)<3000"],
    "http_req_duration{kind:page}": ["p(95)<4000"]
  }
};

function idsFrom(res, key) {
  try {
    return (res.json(`data.${key}`) || res.json(key) || []).map((row) => row.userId || row.id).filter(Boolean);
  } catch {
    return [];
  }
}

export function setup() {
  return {
    ids: idsFrom(http.get(`${BASE}/api/salons?limit=50`), "salons"),
    artistIds: idsFrom(http.get(`${BASE}/api/artists?limit=50`), "artists")
  };
}

function pick(list) {
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

function record(res, kind) {
  (kind === "page" ? pageMs : apiMs).add(res.timings.duration);
  if (res.status === 429) limited.add(1);
  else if (res.status >= 500 || res.status === 0) failed.add(1);
  check(res, { "not a server error": (r) => r.status < 500 && r.status !== 0 });
}

function today(offset) {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toISOString().slice(0, 10);
}

export default function (data) {
  const roll = Math.random();
  const tag = (kind) => ({ tags: { kind } });

  // Everybody lands on the home page and the app shell, then reads the config the sign-up form needs.
  if (roll < 0.3) {
    record(http.get(`${BASE}/`, tag("page")), "page");
    record(http.get(`${BASE}/api/auth/otp/config`, tag("api")), "api");
  } else if (roll < 0.5) {
    // The directory every opened app downloads.
    record(http.get(`${BASE}/api/salons?limit=50`, tag("api")), "api");
    record(http.get(`${BASE}/api/artists?limit=50`, tag("api")), "api");
  } else if (roll < 0.75) {
    // A public salon page and its free times: the step right before a booking.
    const id = pick(data.ids);
    if (id) {
      record(http.get(`${BASE}/salons/${id}`, tag("page")), "page");
      const days = [0, 1, 2, 3, 4, 5, 6].map((n) => `day=${today(n)}`).join("&");
      record(http.get(`${BASE}/api/salon-bookings/availability/days?salonUserId=${id}&${days}`, tag("api")), "api");
    }
  } else if (roll < 0.9) {
    const id = pick(data.artistIds);
    if (id) record(http.get(`${BASE}/artists/${id}`, tag("page")), "page");
  } else {
    record(http.get(`${BASE}/api/health`, tag("api")), "api");
    record(
      http.post(`${BASE}/api/landing-visit`, JSON.stringify({ source: "loadtest", kind: "open" }), {
        headers: { "Content-Type": "application/json" },
        tags: { kind: "api" }
      }),
      "api"
    );
  }
  sleep(Math.random() * 2);
}
