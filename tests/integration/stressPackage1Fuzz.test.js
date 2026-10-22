import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  openDb, clearThrottles, makeSalon, makeClients, call, tally, bad, latency, note, futureBookingDay, healthy,
  createClient, registerUser, TEST_BASE_URL
} from "./stressPackage1Helpers.js";

/**
 * Package 1 under load, part D: junk in, always a clean 4xx out. Random malformed bodies (huge strings, NUL bytes,
 * odd dates, negative and huge numbers, Arabic-Indic digits, wrong shapes, broken JSON) on the booking, service and
 * artist-booking routes. Never a 5xx, never a hung request, and nothing odd ends up in the tables.
 */
const { db, connected } = openDb();
beforeAll(async () => { await connected; });
afterAll(async () => { await db.end(); });

const day = (n = 3) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const SERVICES = [{ name: "S30", duration: "۳۰ دقیقه" }, { name: "S60", duration: "۶۰ دقیقه" }];

// Small seeded generator so a failure can be repeated with the same junk.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const SEED = Number(process.env.P1_FUZZ_SEED) || 20261022;
const random = rng(SEED);
const pick = (list) => list[Math.floor(random() * list.length)];

const NASTY = [
  null, "", " ", "a\u0000b", "\u0000", -1, -0.5, 0, 1e21, 2 ** 53, 2 ** 31, -(2 ** 31), 1.5, NaN, Infinity, "NaN", "Infinity", "-1", "1e9", "0x10", "abc", [], [[]], {}, { a: { b: 1 } }, true, false,
  "x".repeat(70_000), "ب".repeat(5_000), "😀".repeat(3_000), "' OR 1=1--", "<script>alert(1)</script>", "${7*7}", "{{7*7}}", "../../etc/passwd", "‮txt", "\ud800", "\udfff",
  "۱۰:۳۰", "١٠:٣٠", "10:30", "25:99", "24:00", "-1:00", "10:60", "10", "10:3", "1030", "10.30", "10：30", "۱۰٫۳۰", "10:30:00", "10:30 PM", "ساعت ۱۰",
  "۱۴۰۵-۰۸-۰۳", "١٤٠٥-٠٨-٠٣", "1405/08/03", "1405-8-3", "1405-13-40", "1405-00-00", "0000-00-00", "9999-99-99", "2026-10-22", "امروز", "فردا", "شنبه", "yesterday", "1405-08-03T10:00", "1405-08-03 10:00",
  "60 دقیقه", "۶۰", "٦٠", "0", "-30", "1e3", "1000000", "99999999999999999999",
  [{ service: "S30" }, { service: "S30" }, { service: "S30" }, { service: "S30" }, { service: "S30" }, { service: "S30" }, { service: "S30" }, { service: "S30" }, { service: "S30" }],
  [{ service: null }], [{ service: "S30", minutes: -5 }], [{ service: "S30", staff: "x".repeat(1000) }], [1, 2, 3], "S30,S60"
];

const randomBodyFor = (kind, ids) => {
  const base = kind === "artist"
    ? { artistUserId: ids.artist, service: "ناخن", bookingDate: day(), time: "10:00" }
    : { salonUserId: ids.salon, service: "S30", bookingDate: day(), time: "10:00" };
  const fields = kind === "artist"
    ? ["artistUserId", "service", "bookingDate", "time", "durationMinutes", "duration", "clientName", "clientPhone", "waitMinutes", "fallbackArtistUserId", "status", "serviceEmoji", "date", "booking_date", "id"]
    : ["salonUserId", "service", "bookingDate", "time", "durationMinutes", "duration", "client", "phone", "waitMinutes", "fallbackSalonUserId", "parts", "staff", "status", "minutes", "serviceEmoji", "date", "booking_date", "id", "autoAssign"];
  const body = { ...base };
  const changes = 1 + Math.floor(random() * 3);
  for (let i = 0; i < changes; i += 1) {
    const field = pick(fields);
    const value = pick(NASTY);
    if (random() < 0.12) delete body[field];
    else body[field] = value;
  }
  return body;
};

const RAW_BODIES = [
  "{", "}", "[]", "null", "true", "123", "\"text\"", "", "{\"a\":", "{\"a\":1,}", "\u0000", "{\"service\":\"\u0000\"}", "[".repeat(5000), "{\"a\":".repeat(3000) + "1" + "}".repeat(3000),
  "{\"salonUserId\":1e999}", "{\"salonUserId\":\"1\",\"salonUserId\":\"2\"}", "{\"__proto__\":{\"x\":1}}", "{\"constructor\":{\"prototype\":{\"x\":1}}}"
];

async function fireBatch(label, jobs, concurrency = 10) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < jobs.length) {
      const index = next;
      next += 1;
      if (index % 12 === 0) await clearThrottles(db);
      results[index] = await jobs[index]();
    }
  }));
  note(label, tally(results), latency(results));
  return results;
}

describe("7) junk on the booking, service and artist-booking routes", () => {
  let ctx; let clients; let artist; let artistClient;
  beforeAll(async () => {
    ctx = await makeSalon("P1 Fuzz Salon", { staffCount: 3, services: SERVICES });
    clients = await makeClients(4, "P1 Fz");
    artistClient = createClient();
    artist = await registerUser(artistClient, { type: "artist", name: `P1 Fuzz Artist ${Math.random().toString(36).slice(2, 7)}` });
    await artistClient.post("/api/artist/me", { name: "ناخن", price: "100", duration: "60 دقیقه" });
  }, 120_000);

  it("random junk in a valid booking body, as a client, as the salon and anonymously: never 5xx, never hangs", async () => {
    const ids = { salon: ctx.salon.user.id, artist: artist.user.id };
    const jobs = [];
    for (let i = 0; i < 260; i += 1) {
      const who = i % 4;
      jobs.push(() => {
        const kind = who === 3 ? "artist" : "salon";
        const body = randomBodyFor(kind, ids);
        const path = kind === "artist" ? "/api/artist/bookings" : "/api/salon-bookings";
        const caller = who === 0 ? clients[0].client : who === 1 ? ctx.salonClient : who === 2 ? clients[1].client : null;
        return call(caller, "POST", path, body);
      });
    }
    const results = await fireBatch("junk bodies", jobs);
    const failures = results.map((r, i) => ({ i, status: r.status, error: r.error, payload: r.payload })).filter((r) => r.status === 0 || r.status >= 500);
    expect(failures.slice(0, 3)).toEqual([]);
    expect(results.filter((r) => r.hung)).toEqual([]);
    // every answer carries a message or data, never an empty body
    expect(results.every((r) => r.payload && Object.keys(r.payload).length > 0)).toBe(true);
  }, 300_000);

  it("raw broken JSON, huge and odd bodies on every creating route: 4xx", async () => {
    const targets = [
      ["/api/salon-bookings", clients[2].client], ["/api/salon-bookings", ctx.salonClient], ["/api/artist/bookings", clients[2].client], ["/api/artist/bookings", null],
      ["/api/salon-services", ctx.salonClient], ["/api/artist/me", artistClient], ["/api/salon-bookings/1/answer", clients[2].client], ["/api/salon-bookings/1/cancel", clients[2].client]
    ];
    const jobs = [];
    const labels = [];
    for (const [path, caller] of targets) for (const raw of RAW_BODIES) { labels.push(`${path} <- ${raw.slice(0, 40)}`); jobs.push(() => call(caller, "POST", path, raw)); }
    // a megabyte-sized body and a few content-type oddities
    for (const [path, caller] of targets.slice(0, 6)) {
      jobs.push(() => call(caller, "POST", path, JSON.stringify({ service: "x".repeat(1_500_000) })));
      jobs.push(() => fetch(`${TEST_BASE_URL}${path}`, { method: "POST", headers: { "Content-Type": "text/plain", ...(caller?.cookie?.() ? { Cookie: caller.cookie() } : {}) }, body: "service=S30", signal: AbortSignal.timeout(30_000) }).then(async (r) => ({ status: r.status, payload: await r.json().catch(() => ({ raw: true })), ms: 0 })).catch((e) => ({ status: 0, error: String(e), payload: {}, ms: 0 })));
    }
    const results = await fireBatch("raw bodies", jobs);
    note("raw bodies that were accepted (2xx)", JSON.stringify(results.map((r, i) => (r.status < 300 ? `${r.status} ${labels[i] || "(big/odd body)"}` : null)).filter(Boolean)));
    const blank = (await db.query("SELECT (SELECT COUNT(*)::int FROM salon_services WHERE salon_user_id = $1 AND TRIM(name) = '') AS salon_blank, (SELECT COUNT(*)::int FROM artist_services WHERE user_id = $2 AND TRIM(name) = '') AS artist_blank", [ctx.salon.user.id, artist.user.id])).rows[0];
    note("services with a blank name after raw bodies", JSON.stringify(blank));
    // a body with no name (broken, empty or a form post) must not create a nameless service that only uses up one of the 100 places
    expect(blank).toEqual({ salon_blank: 0, artist_blank: 0 });
    const failures = results.map((r, i) => ({ i, status: r.status, error: r.error })).filter((r) => r.status === 0 || r.status >= 500);
    expect(failures.slice(0, 3)).toEqual([]);
  }, 300_000);

  it("known-bad single fields are refused with a 4xx (never saved, never 2xx)", async () => {
    await clearThrottles(db);
    const d = day();
    const good = { salonUserId: ctx.salon.user.id, service: "S30", bookingDate: d, time: "10:00" };
    const cases = [
      ["time 25:99", { time: "25:99" }], ["time 24:00", { time: "24:00" }], ["time -1:00", { time: "-1:00" }], ["time text", { time: "ساعت ۱۰" }], ["time object", { time: {} }], ["time array", { time: ["10:00"] }],
      ["time number", { time: 1000 }], ["date 1405-13-40", { bookingDate: "1405-13-40" }], ["date 0000-00-00", { bookingDate: "0000-00-00" }], ["date gregorian", { bookingDate: "2026-10-22" }],
      ["date text", { bookingDate: "never" }], ["date number", { bookingDate: 14050803 }], ["date array", { bookingDate: [d] }], ["date far past", { bookingDate: "1300-01-01" }],
      ["minutes -5", { durationMinutes: -5 }], ["minutes 1e21", { durationMinutes: 1e21 }], ["minutes text", { durationMinutes: "abc" }], ["minutes 0.5", { durationMinutes: 0.5 }], ["minutes huge text", { durationMinutes: "9".repeat(40) }],
      ["service missing", { service: undefined }], ["service empty", { service: "" }], ["service unlisted", { service: "نیست" }], ["service object", { service: {} }], ["service 70k", { service: "x".repeat(70_000) }],
      ["service number", { service: 30 }], ["parts not array", { parts: "S30" }], ["parts unlisted", { parts: [{ service: "nope" }, { service: "S30" }] }], ["parts 9 items", { parts: Array.from({ length: 9 }, () => ({ service: "S30" })) }],
      ["wait 30", { waitMinutes: 30 }], ["wait text", { waitMinutes: "60" }], ["salon id text", { salonUserId: "abc" }], ["salon id 0", { salonUserId: 0 }], ["salon id negative", { salonUserId: -1 }], ["salon id 1e21", { salonUserId: 1e21 }],
      ["salon id not a salon", { salonUserId: clients[0].user.id }], ["salon id missing salon", { salonUserId: 999999999 }]
    ];
    const rejected = [];
    for (const [label, change] of cases) {
      const body = { ...good, ...change };
      for (const key of Object.keys(change)) if (change[key] === undefined) delete body[key];
      const r = await call(clients[3].client, "POST", "/api/salon-bookings", body);
      if (!(r.status >= 400 && r.status < 500)) rejected.push(`${label}: ${r.status} ${JSON.stringify(r.payload).slice(0, 120)}`);
      if (r.status === 201) await db.query("UPDATE salon_bookings SET status = 'لغو' WHERE client_user_id = $1", [clients[3].user.id]);
    }
    expect(rejected).toEqual([]);
    // the same for the artist route
    const artistGood = { artistUserId: artist.user.id, service: "ناخن", bookingDate: d, time: "10:00" };
    const artistCases = [["time 25:99", { time: "25:99" }], ["date 1405-13-40", { bookingDate: "1405-13-40" }], ["service unlisted", { service: "نیست" }], ["minutes -5", { durationMinutes: -5 }], ["artist id text", { artistUserId: "abc" }], ["artist id is a client", { artistUserId: clients[0].user.id }], ["wait 30", { waitMinutes: 30 }]];
    const artistBad = [];
    for (const [label, change] of artistCases) {
      const r = await call(clients[3].client, "POST", "/api/artist/bookings", { ...artistGood, ...change });
      if (!(r.status >= 400 && r.status < 500)) artistBad.push(`${label}: ${r.status} ${JSON.stringify(r.payload).slice(0, 120)}`);
    }
    expect(artistBad).toEqual([]);
  }, 120_000);

  it("junk on the service routes (create, rename, delete) of a salon and an artist: never 5xx", async () => {
    const jobs = [];
    const serviceFields = ["name", "price", "duration", "hint", "emoji", "staff_id", "staff_ids", "id", "badge", "tone"];
    for (let i = 0; i < 200; i += 1) {
      jobs.push(() => {
        const body = { name: `fz ${i}`, price: "100", duration: "30 دقیقه" };
        for (let k = 0; k < 1 + Math.floor(random() * 3); k += 1) body[pick(serviceFields)] = pick(NASTY);
        const method = pick(["POST", "POST", "PATCH", "DELETE"]);
        const salonSide = i % 2 === 0;
        return call(salonSide ? ctx.salonClient : artistClient, method, salonSide ? "/api/salon-services" : "/api/artist/me", body);
      });
    }
    const results = await fireBatch("service junk", jobs);
    const failures = results.map((r, i) => ({ i, status: r.status, error: r.error, payload: r.payload })).filter((r) => r.status === 0 || r.status >= 500);
    expect(failures.slice(0, 3)).toEqual([]);
    // services that were saved are within bounds, and the cap holds
    const sal = (await db.query("SELECT COUNT(*)::int n, MAX(LENGTH(name))::int mx FROM salon_services WHERE salon_user_id = $1", [ctx.salon.user.id])).rows[0];
    const art = (await db.query("SELECT COUNT(*)::int n, MAX(LENGTH(name))::int mx FROM artist_services WHERE user_id = $1", [artist.user.id])).rows[0];
    note("services after junk", JSON.stringify({ salon: sal, artist: art }));
    expect(sal.n).toBeLessThanOrEqual(100);
    expect(art.n).toBeLessThanOrEqual(100);
    expect(sal.mx).toBeLessThanOrEqual(120);
  }, 300_000);

  it("junk on the availability and list reads, the answer / cancel / approve routes with odd ids: never 5xx", async () => {
    const jobs = [];
    const qs = ["salonUserId", "day", "service", "minutes"];
    for (let i = 0; i < 150; i += 1) {
      jobs.push(() => {
        const params = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day: day(), service: "S30" });
        for (let k = 0; k < 1 + Math.floor(random() * 2); k += 1) {
          const v = pick(NASTY);
          params.set(pick(qs), typeof v === "string" || typeof v === "number" ? String(v).slice(0, 3000) : JSON.stringify(v));
        }
        return call(clients[i % 3].client, "GET", `/api/salon-bookings/availability?${params}`);
      });
    }
    const ids = ["0", "-1", "abc", "1e21", "99999999999999999999", "1.5", "%00", "٣", "undefined", "NaN"];
    for (const id of ids) {
      jobs.push(() => call(clients[0].client, "POST", `/api/salon-bookings/${id}/answer`, { accept: true }));
      jobs.push(() => call(clients[0].client, "POST", `/api/salon-bookings/${id}/cancel`, {}));
      jobs.push(() => call(clients[0].client, "POST", `/api/artist-bookings/${id}/cancel`, {}));
      jobs.push(() => call(ctx.salonClient, "PATCH", "/api/salon-bookings", { id, status: "تایید شده" }));
      jobs.push(() => call(artistClient, "PATCH", "/api/artist/me", { kind: "booking", id, status: "تایید شده" }));
      jobs.push(() => call(clients[0].client, "GET", `/api/salon-bookings?salonUserId=${id}`));
    }
    const results = await fireBatch("junk reads / ids", jobs);
    const failures = results.map((r, i) => ({ i, status: r.status, error: r.error, payload: r.payload })).filter((r) => r.status === 0 || r.status >= 500);
    expect(failures.slice(0, 3)).toEqual([]);
  }, 300_000);

  it("whatever got saved during the junk is sane, and the server is still healthy", async () => {
    const rows = (await db.query(
      "SELECT id, time, booking_date, duration_minutes, status FROM salon_bookings WHERE salon_user_id = $1", [ctx.salon.user.id]
    )).rows;
    const norm = (t) => String(t).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
    const strange = rows.filter((r) => !/^\d{2}:\d{2}$/.test(norm(r.time)) || !/^\d{4}-\d{2}-\d{2}$/.test(r.booking_date) || r.duration_minutes < 1 || r.duration_minutes > 720);
    note("salon bookings saved during junk", rows.length, "strange", strange.length);
    expect(strange).toEqual([]);
    const artistRows = (await db.query("SELECT id, time, booking_date, duration_minutes FROM artist_bookings WHERE artist_user_id = $1", [artist.user.id])).rows;
    expect(artistRows.filter((r) => !/^\d{2}:\d{2}$/.test(norm(r.time)) || !/^\d{4}-\d{2}-\d{2}$/.test(r.booking_date) || r.duration_minutes < 1 || r.duration_minutes > 720)).toEqual([]);
    expect(await healthy()).toBe(true);
  });
});
