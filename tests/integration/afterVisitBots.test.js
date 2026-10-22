import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync } from "node:fs";
import { futureBookingDay } from "./helpers.js";
import {
  CONFIRMED, CANCELLED, EXPIRED, PENDING_SALON, PENDING_ARTIST, openDb, tehranMinutes, daysAgoKey, todayKey,
  reminderSweep, newSalon, newDirectArtist, newClient, requestSalon, requestArtist,
  confirmSalon, confirmArtist, cancelBySalon, cancelByArtist, cancelByClient, moveBooking
} from "./afterVisitKit.js";
import { isSlotInPast } from "../../app/shared/lib/slots.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";

/**
 * Bots: a small town of clients, salons (two with a team artist) and independent artists live through
 * booking -> answer -> the visit time passing -> everyone poking at it afterwards, many times over, all at once.
 * Time passes through the time machine (moveBooking). After every round the hard rules below must hold;
 * the soft findings (things that work today but are probably not wanted) are counted for the report.
 *
 * Pressure is set from the environment, so the same file is a quick check in the normal suite and a long
 * soak by hand:
 *   BOT_ROUNDS (default 3), BOT_CLIENTS (default 12), BOT_SEED (default 1),
 *   BOT_REPORT=<path> writes the findings as JSON.
 *   e.g. BOT_ROUNDS=20 BOT_CLIENTS=40 BOT_REPORT=bots.json npx vitest run tests/integration/afterVisitBots.test.js
 */
const ROUNDS = Number(process.env.BOT_ROUNDS) || 3;
const CLIENTS = Number(process.env.BOT_CLIENTS) || 12;
const SEED = Number(process.env.BOT_SEED) || 1;
const TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const RELEASED = new Set([CANCELLED, EXPIRED, "لغو شده", "cancelled"]);

const db = openDb();
afterAll(() => db.end());

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Every API call a bot makes goes through here: timing, and a count of server errors (5xx never allowed). */
function makeMeter() {
  const calls = {};
  return {
    calls,
    async run(name, fn) {
      const started = performance.now();
      const res = await fn();
      const entry = (calls[name] ||= { count: 0, ms: [], statuses: {} });
      entry.count += 1;
      entry.ms.push(performance.now() - started);
      entry.statuses[res.status] = (entry.statuses[res.status] || 0) + 1;
      return res;
    },
    summary() {
      return Object.fromEntries(Object.entries(calls).map(([name, entry]) => {
        const sorted = [...entry.ms].sort((a, b) => a - b);
        const at = (q) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
        return [name, { count: entry.count, p50ms: at(0.5), p95ms: at(0.95), maxMs: Math.round(sorted.at(-1)), statuses: entry.statuses }];
      }));
    }
  };
}

const findings = {
  // "who:when" -> how many finished visits an owner managed to cancel (the client is texted «لغو شد» each time)
  ownerCancelledFinishedVisit: {},
  clientTextedCancelAfterVisit: 0,
  lateApprovalAfterStart: 0,
  finishedVisitsWithNoOutcome: 0,
  pendingAfterStartBeforeSweep: 0
};

function countOwnerCancel(who, when) {
  const key = `${who}:${when}`;
  findings.ownerCancelledFinishedVisit[key] = (findings.ownerCancelledFinishedVisit[key] || 0) + 1;
  findings.clientTextedCancelAfterVisit += 1;
}

async function buildTown(random) {
  const salons = [
    await newSalon("Bot A", { withArtist: true }),
    await newSalon("Bot B", { withArtist: true }),
    await newSalon("Bot C")
  ];
  const artists = [await newDirectArtist("Bot Artist X"), await newDirectArtist("Bot Artist Y")];
  const clients = [];
  for (let i = 0; i < CLIENTS; i += 1) clients.push(await newClient(`Bot Client ${i}`));
  return { salons, artists, clients, providers: [...salons, ...artists], random };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];

/** Phase 1: everyone asks for a time at once. */
async function bookAll(town, meter) {
  const { random } = town;
  const results = await Promise.all(town.clients.map(async (client) => {
    const provider = pick(random, town.providers);
    const dayOffset = 2 + Math.floor(random() * 3);
    const opts = { day: futureBookingDay(dayOffset), time: pick(random, TIMES) };
    if (provider.kind === "salon") {
      if (provider.staffName) opts.staff = provider.staffName;
      const res = await meter.run("client requests salon", () => requestSalon(provider, client, opts));
      return res.status === 201 ? { table: "salon_bookings", id: res.payload.data.booking.id, provider, client, dayOffset } : null;
    }
    const res = await meter.run("client requests artist", () => requestArtist(provider, client, opts));
    return res.status === 201 ? { table: "artist_bookings", id: res.payload.data.booking.id, provider, client, dayOffset } : null;
  }));
  return results.filter(Boolean);
}

/** Phase 2: owners answer. Most approve, some decline, some never answer; some tap twice, or approve and cancel at once. */
async function answerAll(town, bookings, meter) {
  const { random } = town;
  await Promise.all(bookings.map(async (b) => {
    const roll = random();
    const approve = () => (b.table === "salon_bookings"
      ? meter.run("owner approves", () => confirmSalon(b.provider, b.id))
      : meter.run("owner approves", () => confirmArtist(b.provider, b.id)));
    const decline = () => (b.table === "salon_bookings"
      ? meter.run("owner declines", () => cancelBySalon(b.provider, b.id))
      : meter.run("owner declines", () => cancelByArtist(b.provider, b.id)));
    if (roll < 0.5) await approve();
    else if (roll < 0.6) await Promise.all([approve(), approve()]);
    else if (roll < 0.65) await Promise.all([approve(), decline()]);
    else if (roll < 0.8) await decline();
    // else: nobody answers
  }));
}

/**
 * Phase 3: time passes. Some visits were days ago, some earlier today, some are still ahead.
 * The move keeps each person's calendar as it was (no two entries pushed on top of each other): every booking
 * of a round goes back by the same number of days plus its own day, and each round lands on its own days.
 * "Earlier today" keeps the booked clock time, so it only happens in round 1 and only for times already past.
 */
async function letTimePass(town, bookings, round) {
  const { random } = town;
  const roundBack = 1 + (round - 1) * 6;
  const todayDay = 2 + Math.floor(random() * 3);
  for (const b of bookings) {
    const { rows } = await db.query(`SELECT time FROM ${b.table} WHERE id = $1`, [b.id]);
    const roll = random();
    if (round === 1 && b.dayOffset === todayDay && isSlotInPast(todayKey(), rows[0].time)) {
      b.when = "earlier-today";
      await moveBooking(db, b.table, b.id, { date: todayKey() });
    } else if (roll < 0.6 && b.dayOffset !== todayDay) {
      b.when = "earlier-day";
      await moveBooking(db, b.table, b.id, { date: daysAgoKey(roundBack + b.dayOffset) });
    } else {
      b.when = "ahead";
    }
  }
}

const statusOf = async (b) => (await db.query(`SELECT status FROM ${b.table} WHERE id = $1`, [b.id])).rows[0]?.status;

/** Phase 4: after the time. Late approvals race the sweep; clients and owners try to cancel what is over. */
async function afterTheTime(town, bookings, meter) {
  const { random } = town;
  const before = new Map();
  for (const b of bookings) before.set(b, await statusOf(b));
  const passed = bookings.filter((b) => b.when !== "ahead");
  findings.pendingAfterStartBeforeSweep += passed.filter((b) => [PENDING_SALON, PENDING_ARTIST].includes(before.get(b))).length;

  const sweepStatuses = [];
  const tasks = [];
  for (let i = 0; i < 3; i += 1) tasks.push(meter.run("expiry sweep", async () => { const r = await fetchSweep(); sweepStatuses.push(r.status); return r; }));
  tasks.push(reminderSweep().then(() => null));
  for (const b of passed) {
    const was = before.get(b);
    const roll = random();
    if ([PENDING_SALON, PENDING_ARTIST].includes(was) && roll < 0.5) {
      tasks.push((async () => {
        const res = b.table === "salon_bookings"
          ? await meter.run("late approve", () => confirmSalon(b.provider, b.id))
          : await meter.run("late approve", () => confirmArtist(b.provider, b.id));
        if (res.ok) findings.lateApprovalAfterStart += 1;
      })());
    }
    if (was === CONFIRMED && roll < 0.35) {
      tasks.push((async () => {
        const res = await meter.run("client cancels after visit", () => cancelByClient(b.client, b.table, b.id));
        b.clientCancelStatus = res.status;
      })());
    }
    if (was === CONFIRMED && roll >= 0.35 && roll < 0.6) {
      tasks.push((async () => {
        const res = b.table === "salon_bookings"
          ? await meter.run("owner cancels after visit", () => cancelBySalon(b.provider, b.id))
          : await meter.run("owner cancels after visit", () => cancelByArtist(b.provider, b.id));
        if (res.ok) countOwnerCancel(b.table === "salon_bookings" ? "salon" : "artist", b.when);
      })());
    }
    if (was === CONFIRMED && roll >= 0.6 && roll < 0.7 && b.provider.artistClient && b.table === "salon_bookings" && b.when === "earlier-day") {
      tasks.push((async () => {
        const mirror = (await db.query(`
          SELECT a.id FROM artist_bookings a JOIN salon_bookings s ON s.id = $1
          WHERE a.source_salon_user_id = s.salon_user_id AND a.client_name = s.client AND a.client_phone = s.phone
            AND a.booking_date = s.booking_date AND a.time = s.time AND a.status = $2
        `, [b.id, CONFIRMED])).rows[0];
        if (!mirror) return;
        const res = await meter.run("team artist cancels after visit", () => b.provider.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: CANCELLED }));
        if (res.ok) countOwnerCancel("team artist", b.when);
      })());
    }
  }
  await Promise.all(tasks);
  await fetchSweep(); // one calm sweep after the storm
  return { before, sweepStatuses };
}

function fetchSweep() {
  return fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
}

/** The rules that must hold today. */
async function checkRules(bookings, { before, sweepStatuses }, label, sinceReminders) {
  expect(sweepStatuses.every((s) => s === 200), `${label}: a sweep failed`).toBe(true);
  for (const b of bookings) {
    const now = await statusOf(b);
    const was = before.get(b);
    // A confirmed visit never turns into "nobody answered".
    if (was === CONFIRMED) expect(now, `${label}: confirmed #${b.id} became expired`).not.toBe(EXPIRED);
    // A client can never cancel once it started.
    if (b.clientCancelStatus !== undefined) expect(b.clientCancelStatus, `${label}: client cancelled #${b.id} after it started`).toBe(409);
    // After the sweep, no request whose time passed is still waiting.
    if (b.when !== "ahead") {
      expect([PENDING_SALON, PENDING_ARTIST].includes(now), `${label}: #${b.id} still waiting after its time (${now})`).toBe(false);
    }
    if (b.when !== "ahead" && now === CONFIRMED) findings.finishedVisitsWithNoOutcome += 1;
  }
  // A salon booking and its team artist's copy always agree.
  const { rows } = await db.query(`
    SELECT s.id, s.status AS salon_status, a.status AS artist_status
    FROM salon_bookings s JOIN artist_bookings a
      ON a.source_salon_user_id = s.salon_user_id AND a.client_name = s.client AND a.client_phone = s.phone
     AND a.service = s.service AND a.booking_date = s.booking_date AND a.time = s.time
    WHERE s.id = ANY($1::int[])
  `, [bookings.filter((b) => b.table === "salon_bookings").map((b) => b.id)]);
  const norm = (s) => (RELEASED.has(s) ? "released" : s === PENDING_ARTIST ? PENDING_SALON : s);
  for (const row of rows) {
    // a released copy next to a new live one is fine; only a live mismatch is a split
    if (norm(row.artist_status) === "released" && norm(row.salon_status) !== "released") continue;
    expect(norm(row.artist_status), `${label}: salon #${row.id} is ${row.salon_status} but the artist sees ${row.artist_status}`).toBe(norm(row.salon_status));
  }
  // No reminder for a visit that had already started.
  const started = bookings.filter((b) => b.when !== "ahead");
  const late = await db.query(`
    SELECT r.source, r.booking_id FROM booking_reminders r
    WHERE r.sent_at >= $1 AND ((r.source = 'salon' AND r.booking_id = ANY($2::int[])) OR (r.source = 'artist' AND r.booking_id = ANY($3::int[])))
  `, [sinceReminders, started.filter((b) => b.table === "salon_bookings").map((b) => b.id), started.filter((b) => b.table === "artist_bookings").map((b) => b.id)]);
  expect(late.rows, `${label}: reminders went out for visits that had started`).toEqual([]);
}

describe("bots: after the visit, under pressure", () => {
  it(`survives ${ROUNDS} rounds with ${CLIENTS} clients (seed ${SEED})`, async () => {
    const town = await buildTown(rng(SEED));
    const meter = makeMeter();
    const rounds = [];
    for (let round = 1; round <= ROUNDS; round += 1) {
      const label = `round ${round}`;
      const bookings = await bookAll(town, meter);
      await answerAll(town, bookings, meter);
      await letTimePass(town, bookings, round);
      const sinceReminders = new Date();
      const state = await afterTheTime(town, bookings, meter);
      await checkRules(bookings, state, label, sinceReminders);
      rounds.push({ round, bookings: bookings.length, earlierDay: bookings.filter((b) => b.when === "earlier-day").length, earlierToday: bookings.filter((b) => b.when === "earlier-today").length });
    }
    const calls = meter.summary();
    const serverErrors = Object.entries(calls).flatMap(([name, c]) => Object.keys(c.statuses).filter((s) => Number(s) >= 500).map((s) => `${name}: ${s} x${c.statuses[s]}`));
    const report = { seed: SEED, rounds, clients: CLIENTS, tehranClockMinutes: tehranMinutes(), findings, calls, serverErrors };
    if (process.env.BOT_REPORT) writeFileSync(process.env.BOT_REPORT, JSON.stringify(report, null, 2));
    console.log("after-visit bots:", JSON.stringify({ findings, serverErrors }, null, 1));
    expect(serverErrors).toEqual([]);
  }, 600_000);
});

// keep the helper honest: the bots' notion of "started" is the app's own
it("the bots' clock agrees with the app's", () => {
  expect(isSlotInPast(daysAgoKey(1), "10:00")).toBe(true);
});
