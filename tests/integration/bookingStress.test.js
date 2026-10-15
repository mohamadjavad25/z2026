import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser, futureBookingDay } from "./helpers.js";
import { scheduleBookingParts } from "../../app/shared/lib/bookingParts.js";
import { timeLabelToMinutes } from "../../app/shared/lib/time.js";

/**
 * Many people booking, moving, approving and cancelling at the same moment, in two salons that share
 * one artist. Whatever order the server happens to see them in, nothing may crash or deadlock, and the
 * calendars must never end up with two active entries on top of each other.
 */
const RELEASED = new Set(["لغو", "لغو شده", "منقضی شده", "cancelled"]);
const active = (rows) => rows.filter((row) => !RELEASED.has(String(row.status || "").trim()));
const overlap = (a, b) => a.start < b.end && b.start < a.end;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

async function makeSalon(name, sharedArtist, ownArtistNames) {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name });
  await salonClient.get("/api/salon-hours");
  const artists = [];
  for (const artistName of ownArtistNames) {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name: artistName });
    expect((await joinSalonAsArtist(client, salonClient, salon.user.id)).ok).toBe(true);
    artists.push({ client, user });
  }
  expect((await joinSalonAsArtist(sharedArtist.client, salonClient, salon.user.id)).ok).toBe(true);
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
  const nameOf = (artist) => staff.find((p) => Number(p.artist_user_id) === Number(artist.user.id)).name;
  const team = [...artists, sharedArtist];
  const services = [];
  for (const [label, minutes, people] of [["کوتاه", 30, team], ["متوسط", 45, [team[0], sharedArtist]], ["بلند", 60, [sharedArtist]]]) {
    const serviceName = `${name} ${label}`;
    const created = await salonClient.post("/api/salon-services", { name: serviceName, price: "100", duration: `${minutes} دقیقه` });
    await salonClient.patch("/api/salon-services", {
      id: created.payload.data.service.id,
      name: serviceName,
      staff_ids: people.map((a) => String(staff.find((p) => p.name === nameOf(a)).id))
    });
    services.push({ name: serviceName, minutes });
  }
  return { salonClient, salon, team, services, staffNames: team.map(nameOf), nameOf };
}

async function checkInvariants(world, day, label) {
  // every artist's own calendar: no two active entries overlap
  for (const artist of world.artists) {
    const mine = active((await artist.client.get("/api/artist/me")).payload.data.bookings).filter((b) => b.booking_date === day);
    const spans = mine.map((b) => ({ start: timeLabelToMinutes(b.time), end: timeLabelToMinutes(b.time) + Number(b.duration_minutes), id: b.id }));
    for (let i = 0; i < spans.length; i += 1) {
      for (let j = i + 1; j < spans.length; j += 1) {
        expect(overlap(spans[i], spans[j]), `${label}: artist ${artist.user.id} has #${spans[i].id} and #${spans[j].id} on top of each other`).toBe(false);
      }
    }
  }
  // every salon: nobody is in two places at once. (An entry with nobody assigned yet holds no one,
  // by policy -- findOverlapConflict only lets a *new* unassigned entry collide with everything.)
  for (const salon of world.salons) {
    const rows = active((await salon.salonClient.get("/api/salon-bookings")).payload.data.bookings).filter((b) => b.booking_date === day);
    const segments = rows.flatMap((b) => {
      let parts;
      try { parts = JSON.parse(b.parts || "[]"); } catch { parts = []; }
      if (parts.length >= 2) return scheduleBookingParts(b.time, parts).map((p) => ({ id: b.id, staff: p.staff, start: p.start, end: p.end }));
      const start = timeLabelToMinutes(b.time);
      return [{ id: b.id, staff: String(b.staff || "").trim(), start, end: start + Number(b.duration_minutes) }];
    });
    for (let i = 0; i < segments.length; i += 1) {
      for (let j = i + 1; j < segments.length; j += 1) {
        const a = segments[i];
        const b = segments[j];
        if (a.id === b.id) continue;
        const conflicts = Boolean(a.staff) && Boolean(b.staff) && a.staff === b.staff;
        expect(conflicts && overlap(a, b), `${label}: salon ${salon.salon.user.id} #${a.id} (${a.staff}) and #${b.id} (${b.staff}) overlap`).toBe(false);
      }
    }
  }
}

async function run(seed) {
  const random = rng(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const shared = { client: createClient() };
  shared.user = (await registerUser(shared.client, { type: "artist", name: `Shared ${seed}` })).user;
  const s1 = await makeSalon(`Stress A ${seed}`, shared, [`A1 ${seed}`, `A2 ${seed}`]);
  const s2 = await makeSalon(`Stress B ${seed}`, shared, [`B1 ${seed}`]);
  const salons = [s1, s2];
  const customers = [];
  for (let i = 0; i < 10; i += 1) {
    const client = createClient();
    const r = await registerUser(client, { type: "client", name: `Cust ${seed}-${i}` });
    customers.push({ client, user: r.user, phone: r.phone });
  }
  const artists = [...s1.team, ...s2.team.filter((a) => a !== shared)];
  const world = { salons, artists: [...new Set(artists)] };
  const day = futureBookingDay(3, { notOn: ["پنجشنبه"] });
  const times = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00"];
  const created = [];
  const statuses = [];
  const record = (res) => { statuses.push(res.status); return res; };
  const track = (salon) => (res) => { if (res.status === 201) created.push({ salon, id: res.payload.data.booking.id }); return res; };

  const operations = {
    clientSingle: () => {
      const salon = pick(salons);
      const customer = pick(customers);
      return customer.client.post("/api/salon-bookings", { salonUserId: salon.salon.user.id, service: pick(salon.services).name, bookingDate: day, time: pick(times), client: customer.user.name, phone: customer.phone })
        .then(record).then(track(salon));
    },
    clientVisit: () => {
      const salon = pick(salons);
      const customer = pick(customers);
      const chosen = [pick(salon.services), pick(salon.services)].filter((s, i, all) => all.indexOf(s) === i);
      if (chosen.length < 2) chosen.push(salon.services.find((s) => !chosen.includes(s)));
      return customer.client.post("/api/salon-bookings", { salonUserId: salon.salon.user.id, service: "x", bookingDate: day, time: pick(times), client: customer.user.name, phone: customer.phone, parts: chosen.map((s) => ({ service: s.name })) })
        .then(record).then(track(salon));
    },
    salonNamed: () => {
      const salon = pick(salons);
      const withStaff = random() < 0.6;
      const service = pick(salon.services);
      const body = { bookingDate: day, time: pick(times), client: "حضوری", phone: "09120000001", service: service.name };
      if (withStaff) body.staff = pick(salon.staffNames);
      return salon.salonClient.post("/api/salon-bookings", body).then(record).then(track(salon));
    },
    salonVisit: () => {
      const salon = pick(salons);
      return salon.salonClient.post("/api/salon-bookings", {
        bookingDate: day, time: pick(times), client: "حضوری", phone: "09120000002", service: "x",
        parts: [{ service: salon.services[0].name, staff: pick(salon.staffNames) }, { service: salon.services[1].name, staff: pick(salon.staffNames) }]
      }).then(record).then(track(salon));
    },
    artistOwn: () => {
      const artist = pick(world.artists);
      return artist.client.post("/api/artist/me", { kind: "booking", client: "خودم", service: "کار شخصی", time: pick(times), date: day, durationMinutes: pick([30, 45, 60]) }).then(record);
    },
    publicArtist: () => {
      const artist = pick(world.artists);
      const customer = pick(customers);
      return customer.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "مستقیم", bookingDate: day, time: pick(times), durationMinutes: 30, clientName: customer.user.name, phone: customer.phone }).then(record);
    },
    move: () => {
      if (!created.length) return Promise.resolve();
      const target = pick(created);
      return target.salon.salonClient.patch("/api/salon-bookings", { id: target.id, time: pick(times) }).then(record);
    },
    cancel: () => {
      if (!created.length) return Promise.resolve();
      const target = pick(created);
      return target.salon.salonClient.patch("/api/salon-bookings", { id: target.id, status: "لغو", action: "cancel" }).then(record);
    },
    approve: () => {
      if (!created.length) return Promise.resolve();
      const target = pick(created);
      return target.salon.salonClient.patch("/api/salon-bookings", { id: target.id, status: "تایید شده" }).then(record);
    },
    autoSplit: () => {
      if (!created.length) return Promise.resolve();
      const target = pick(created);
      return target.salon.salonClient.patch("/api/salon-bookings", { id: target.id, autoAssign: true }).then(record);
    }
  };
  const weights = [["clientSingle", 5], ["clientVisit", 5], ["salonNamed", 3], ["salonVisit", 3], ["artistOwn", 3], ["publicArtist", 3], ["move", 3], ["cancel", 2], ["approve", 2], ["autoSplit", 2]];
  const bag = weights.flatMap(([name, n]) => Array(n).fill(name));

  for (let wave = 0; wave < 6; wave += 1) {
    await Promise.all(Array.from({ length: 14 }, () => operations[pick(bag)]()));
    await checkInvariants(world, day, `seed ${seed} wave ${wave}`);
  }
  return statuses;
}

describe("concurrent booking, moving and cancelling", () => {
  // STRESS_SEEDS=1,2,3 runs other schedules (for a longer soak than the default three)
  const seeds = process.env.STRESS_SEEDS ? process.env.STRESS_SEEDS.split(",").map(Number) : [11, 4242, 90210];
  for (const seed of seeds) {
    it(`never crashes and never leaves two entries on top of each other (seed ${seed})`, async () => {
      const statuses = await run(seed);
      const failures = statuses.filter((s) => s >= 500);
      expect(failures, `server errors: ${JSON.stringify(statuses)}`).toEqual([]);
      // the run really mixed outcomes: some went through, some were refused
      expect(statuses.filter((s) => s === 201).length).toBeGreaterThan(5);
      expect(statuses.filter((s) => s === 409).length).toBeGreaterThan(5);
    }, 180_000);
  }
});
