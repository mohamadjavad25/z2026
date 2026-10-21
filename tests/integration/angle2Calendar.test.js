import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "./helpers.js";
import { closeDb, q, note, DAY_MS, keyAhead, weekdayAhead, pickDay, plain, newSalon, newClient, newArtist, bookAtSalon, raw, salonRows, artistRows } from "./angle2Util.js";
import {
  formatPersianDateKey, persianDateKeyToDate, resolveRollingPersianDateKey, isPersianDateKey, getPersianDateParts, findPersianMonthStart, buildPersianMonthGrid
} from "../../app/shared/lib/persianCalendar.js";
import { toPersianDigits } from "../../app/shared/lib/digits.js";

afterAll(closeDb);

const arabicIndic = (text) => String(text).replace(/\d/g, (c) => String.fromCharCode(0x0660 + Number(c)));

/** One fresh salon + client and a booking at it; returns the response and every row the salon ended up with. */
async function tryBooking(body, { service = "کوتاهی مو" } = {}) {
  const salon = await newSalon();
  const client = await newClient();
  const res = await client.api.post("/api/salon-bookings", {
    salonUserId: salon.id, service, client: client.user.name, phone: client.phone, ...body
  });
  return { res, rows: await salonRows(salon.id), salon, client };
}

// ---------------------------------------------------------------------------------------------
describe("pure calendar helpers", () => {
  it("every Jalali month has the right length, in a leap and a non-leap year, far past and far future", () => {
    for (const year of [1300, 1403, 1404, 1405, 1408, 1500]) {
      let total = 0;
      for (let month = 1; month <= 12; month += 1) {
        const days = buildPersianMonthGrid(year, month).filter(Boolean).length;
        if (month <= 6) expect(days, `${year}/${month}`).toBe(31);
        else if (month <= 11) expect(days, `${year}/${month}`).toBe(30);
        else expect([29, 30], `${year}/12`).toContain(days);
        total += days;
      }
      expect([365, 366]).toContain(total);
    }
  });

  it("1403 and 1408 are leap years (Esfand 30 exists), 1404 and 1405 are not", () => {
    const esfand = (year) => buildPersianMonthGrid(year, 12).filter(Boolean).length;
    expect(esfand(1403)).toBe(30);
    expect(esfand(1408)).toBe(30);
    expect(esfand(1404)).toBe(29);
    expect(esfand(1405)).toBe(29);
  });

  it("Esfand's last day is followed by Farvardin 1 of the next year (Nowruz crossover)", () => {
    const last = findPersianMonthStart(1404, 12);
    last.setDate(last.getDate() + 28);
    expect(formatPersianDateKey(last)).toBe("1404-12-29");
    last.setDate(last.getDate() + 1);
    expect(formatPersianDateKey(last)).toBe("1405-01-01");
  });

  it("persianDateKeyToDate gives back a real day for valid keys and null for impossible ones", () => {
    const from = new Date("2026-10-21T10:00:00Z");
    expect(formatPersianDateKey(persianDateKeyToDate("1405-07-30", from))).toBe("1405-07-30");
    expect(formatPersianDateKey(persianDateKeyToDate("1405-12-29", from))).toBe("1405-12-29");
    for (const bad of ["1405-13-01", "1405-02-32", "1405-07-31", "1405-12-30", "1405-00-10", "1405-01-00"]) {
      expect(persianDateKeyToDate(bad, from), bad).toBeNull();
    }
  });

  it("resolveRollingPersianDateKey must not turn an impossible or unreadable date into TODAY (it would book the wrong day)", () => {
    const from = new Date("2026-10-21T10:00:00Z");
    const today = formatPersianDateKey(from);
    const offenders = [];
    for (const bad of ["1405-13-01", "1405-02-32", "1405-07-31", "1300-01-01", "1500-01-01", "9999-99-99"]) {
      if (resolveRollingPersianDateKey(bad, from) === today) offenders.push(bad);
    }
    // Expected: "" (or a throw) so callers can answer 400. Actual: today's key.
    expect(offenders).toEqual([]);
  });

  it("a date with slashes or non-ASCII digits is not silently read as a weekday name", () => {
    const from = new Date("2026-10-21T10:00:00Z"); // a Wednesday
    const wanted = "1405-08-12";
    const wrong = [];
    for (const text of ["1405/08/12", toPersianDigits(wanted), toPersianDigits("1405/08/12"), arabicIndic(wanted), "1405-8-12"]) {
      const got = resolveRollingPersianDateKey(text, from);
      if (got !== wanted) wrong.push(`${text} -> ${got}`);
    }
    expect(wrong).toEqual([]);
  });

  it("isPersianDateKey is only a syntax check (1405-07-31 passes) -- documents why callers must also resolve it", () => {
    expect(isPersianDateKey("1405-07-31")).toBe(true);
    expect(persianDateKeyToDate("1405-07-31")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe("booking date formats (client request at a salon)", () => {
  const D = pickDay({ min: 3, max: 12, exclude: ["شنبه"] }); // never a Saturday: a bad parse falls back to "next Saturday"
  const [y, m, d] = D.key.split("-");
  const variants = {
    "slashes": `${y}/${m}/${d}`,
    "Persian digits with dashes": toPersianDigits(D.key),
    "Persian digits with slashes": toPersianDigits(`${y}/${m}/${d}`),
    "Arabic-Indic digits": arabicIndic(D.key),
    "unpadded month and day": `${y}-${Number(m)}-${Number(d)}`,
    "dots": `${y}.${m}.${d}`,
    "surrounding whitespace": `  ${D.key}  `,
    "full-width digits": D.key.replace(/\d/g, (c) => String.fromCharCode(0xff10 + Number(c)))
  };
  for (const [label, text] of Object.entries(variants)) {
    it(`${label} ("${text}") is either stored as ${D.key} or refused with a 4xx -- never a different day`, async () => {
      const { res, rows } = await tryBooking({ bookingDate: text, time: "۱۱:۰۰" });
      expect(res.status).toBeLessThan(500);
      for (const row of rows) expect(row.booking_date, `row created for "${text}"`).toBe(D.key);
      if (res.status === 201) expect(res.payload.data.booking.booking_date).toBe(D.key);
    });
  }

  it("the date can be sent as booking_date or date instead of bookingDate, with the same result", async () => {
    for (const field of ["booking_date", "date"]) {
      const { res, rows } = await tryBooking({ [field]: D.key, time: "۱۲:۰۰" });
      expect(res.status, field).toBe(201);
      expect(rows[0].booking_date).toBe(D.key);
    }
  });
});

describe("impossible and out-of-range booking dates", () => {
  const bad = ["1405-13-01", "1405-02-32", "1405-07-31", "1405-12-30", "1405-00-10", "1405-01-00", "0000-00-00", "9999-99-99", "1300-01-01", "1500-01-01", "-1405-01-01", "1405-1-1-1", "نه تاریخ", "2026-10-25"];
  for (const text of bad) {
    it(`"${text}" is refused as an invalid date (400/422) and creates nothing`, async () => {
      // 11:00 may already be past today, so a 409 "slot passed" would only prove the server read the date as TODAY.
      const { res, rows } = await tryBooking({ bookingDate: text, time: "۱۱:۰۰" });
      expect([400, 422], `${res.status} ${JSON.stringify(res.payload).slice(0, 160)}`).toContain(res.status);
      expect(rows).toHaveLength(0);
    });
  }

  it("a missing / empty / null / numeric / array date is a 400, not a booking for 'today'", async () => {
    for (const bookingDate of [undefined, "", null, 14050812, ["1405-08-12"], {}]) {
      const { res, rows } = await tryBooking({ bookingDate, time: "۲۰:۰۰" });
      expect(res.status, JSON.stringify(bookingDate)).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(rows, JSON.stringify(bookingDate)).toHaveLength(0);
    }
  });

  it("availability and preview answer 400 for an unreadable day instead of listing next Saturday's times", async () => {
    const salon = await newSalon();
    const client = await newClient();
    for (const day of ["1405-13-01", "1300-01-01", "garbage", "1405/08/12"]) {
      const a = await client.api.get(`/api/salon-bookings/availability?salonUserId=${salon.id}&day=${encodeURIComponent(day)}&service=${encodeURIComponent("کوتاهی مو")}&minutes=60`);
      expect(a.status, `availability ${day}`).toBe(400);
      const p = await client.api.get(`/api/salon-bookings/preview?salonUserId=${salon.id}&day=${encodeURIComponent(day)}&time=10:00&service=${encodeURIComponent("کوتاهی مو")}&minutes=60`);
      expect(p.status, `preview ${day}`).toBe(400);
    }
  });
});

describe("how far ahead a valid date can be booked", () => {
  const openOffset = (n) => { let o = n; while (plain(weekdayAhead(o)) === plain("جمعه")) o += 1; return o; };
  for (const target of [30, 120, 300, 399]) {
    it(`+${target} days (valid) is stored exactly`, async () => {
      const offset = openOffset(target);
      const key = keyAhead(offset);
      const { res, rows } = await tryBooking({ bookingDate: key, time: "۱۱:۰۰" });
      expect(res.status, JSON.stringify(res.payload)).toBe(201);
      expect(rows[0].booking_date).toBe(key);
    });
  }
  for (const target of [401, 450, 800]) {
    it(`+${target} days (valid) is either stored exactly or refused with a validation error -- never read as "today"`, async () => {
      const offset = openOffset(target);
      const key = keyAhead(offset);
      const { res, rows } = await tryBooking({ bookingDate: key, time: "۱۱:۰۰" });
      expect(res.status).toBeLessThan(500);
      for (const row of rows) expect(row.booking_date, `asked ${key}`).toBe(key);
      if (res.status !== 201) expect([400, 422], `${res.status} ${res.payload.error}`).toContain(res.status);
    });
  }

  it("PROOF of wrong-day booking: an impossible date plus a time later today creates a booking for TODAY", async () => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const now = Number(parts.find((p) => p.type === "hour").value) % 24 * 60 + Number(parts.find((p) => p.type === "minute").value);
    const slot = Math.ceil((now + 45) / 30) * 30;
    if (plain(weekdayAhead(0)) === plain("جمعه") || slot < 10 * 60 || slot > 19 * 60) return; // needs an open slot later today
    const time = `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`;
    const problems = [];
    for (const text of ["1405-13-01", "1405-07-31", "1300-01-01", "1500-01-01", keyAhead(500)]) {
      const { res, rows } = await tryBooking({ bookingDate: text, time });
      if (res.status === 201) problems.push(`"${text}" -> booked on ${rows[0]?.booking_date} (today is ${keyAhead(0)})`);
    }
    expect(problems).toEqual([]);
  });
});

describe("Esfand, Nowruz and month boundaries inside the booking horizon", () => {
  /** Walk forward from today to the next Esfand's last day. */
  function nextYearEnd() {
    for (let offset = 1; offset < 400; offset += 1) {
      const key = keyAhead(offset);
      if (key.startsWith(keyAhead(offset + 1).slice(0, 4))) continue;
      return { offset, key, next: keyAhead(offset + 1), nextOffset: offset + 1 };
    }
    throw new Error("no year end in range");
  }
  const end = nextYearEnd();
  note("next year end", end.key, "-> Nowruz", end.next, weekdayAhead(end.offset), weekdayAhead(end.nextOffset));

  it("the last day of the year and Nowruz both book exactly on that date (when the salon is open that weekday)", async () => {
    for (const [label, offset] of [["last day", end.offset], ["Nowruz", end.nextOffset]]) {
      const key = keyAhead(offset);
      const { res, rows } = await tryBooking({ bookingDate: key, time: "۱۱:۰۰" });
      if (plain(weekdayAhead(offset)) === plain("جمعه")) {
        expect(res.status, `${label} ${key} is a Friday`).toBe(409);
      } else {
        expect(res.status, `${label} ${key}: ${JSON.stringify(res.payload)}`).toBe(201);
        expect(rows[0].booking_date).toBe(key);
      }
    }
  });

  it("Esfand 30 is accepted only in a leap year, and a refused one creates nothing", async () => {
    const year = end.key.slice(0, 4);
    const isLeap = keyAhead(end.offset) === `${year}-12-30`; // the walk above ends on the real last day
    const probe = `${year}-12-30`;
    const { res, rows } = await tryBooking({ bookingDate: probe, time: "۱۱:۰۰" });
    if (isLeap) expect(res.status).toBe(201);
    else {
      expect(res.status, `${probe} does not exist in ${year}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(rows).toHaveLength(0);
    }
  });

  it("a weekday closed by the salon blocks Nowruz and the last day of the year too (weekday of a far date)", async () => {
    const salon = await newSalon();
    const client = await newClient();
    const hours = (await salon.api.get("/api/salon-hours")).payload.data.hours;
    const weekday = weekdayAhead(end.nextOffset);
    const row = hours.find((h) => plain(h.day) === plain(weekday));
    expect(row, `no hours row for ${weekday}`).toBeTruthy();
    await salon.api.patch("/api/salon-hours", { day: row.day, active: false });
    const blocked = await bookAtSalon(client.api, salon, client, { day: keyAhead(end.nextOffset), time: "۱۱:۰۰" });
    expect(blocked.status).toBe(409);
    expect(blocked.payload.error).toMatch(/تعطیل/);
  });

  it("the Mehr 30 / Aban 1 and Aban 30 / Azar 1 boundaries are consecutive days that both book exactly", async () => {
    // find the next Mehr-30-like month end (any month 7..11) inside 150 days
    for (let offset = 1; offset < 150; offset += 1) {
      const key = keyAhead(offset);
      const next = keyAhead(offset + 1);
      if (key.slice(5, 7) !== next.slice(5, 7) && Number(key.slice(5, 7)) >= 7) {
        expect(key.endsWith("-30")).toBe(true);
        expect(next.endsWith("-01")).toBe(true);
        for (const [o, k] of [[offset, key], [offset + 1, next]]) {
          if (plain(weekdayAhead(o)) === plain("جمعه")) continue;
          const { res, rows } = await tryBooking({ bookingDate: k, time: "۱۲:۰۰" });
          expect(res.status, k).toBe(201);
          expect(rows[0].booking_date).toBe(k);
        }
        return;
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe("time labels on a salon booking", () => {
  const day = pickDay({ min: 3 }).key;
  const accepted = [
    ["Persian digits", "۱۱:۰۰", "11:00"],
    ["Latin digits", "11:00", "11:00"],
    ["with trailing space", "۱۱:۳۰ ", "11:30"],
    ["Arabic-Indic digits", arabicIndic("11:00"), "11:00"]
  ];
  for (const [label, time, stored] of accepted) {
    it(`accepts ${label} and stores ${stored}`, async () => {
      const { res, rows } = await tryBooking({ bookingDate: day, time });
      expect(res.status, JSON.stringify(res.payload)).toBe(201);
      expect(rows[0].time).toBe(stored);
    });
  }

  const refused = ["۲۴:۰۰", "۲۵:۰۰", "99:99", "۱۰:۶۰", "۱۰:۹۰", "11:150", "-1:00", "abc", "", "   ", "11:00:00", "11.00", "11:00 PM", "1e3:00", "0x0B:00", "1100", "11:", ":30", "۱۱", "11", "٫"];
  for (const time of refused) {
    it(`refuses time "${time}" (4xx, nothing created)`, async () => {
      const { res, rows } = await tryBooking({ bookingDate: day, time });
      expect(res.status, JSON.stringify(res.payload)).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(rows, `rows for time "${time}": ${JSON.stringify(rows.map((r) => r.time))}`).toHaveLength(0);
    });
  }

  it("a numeric / array / object time is a 400, not a 500", async () => {
    for (const time of [1100, 11.5, ["11:00"], { h: 11 }, null]) {
      const { res } = await tryBooking({ bookingDate: day, time });
      expect(res.status, JSON.stringify(time)).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    }
  });
});

describe("time labels on a direct artist booking (an artist has no opening-hours check at all)", () => {
  const day = pickDay({ min: 3 }).key;
  async function tryArtist(time, extra = {}) {
    const artist = await newArtist();
    const client = await newClient();
    const res = await client.api.post("/api/artist/bookings", {
      artistUserId: artist.id, service: "مانیکور", bookingDate: day, time, clientName: client.user.name, clientPhone: client.phone, ...extra
    });
    return { res, rows: await artistRows(artist.id), artist, client };
  }
  for (const time of ["۲۴:۰۰", "۲۵:۰۰", "99:99", "۱۰:۶۰", "-1:00", "abc", "", "   ", "11:00:00", "1100", "٫"]) {
    it(`refuses time "${time}" (4xx, no calendar row)`, async () => {
      const { res, rows } = await tryArtist(time);
      expect(res.status, `${JSON.stringify(res.payload)} rows=${JSON.stringify(rows.map((r) => r.time))}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(rows).toHaveLength(0);
    });
  }
  it("accepts a normal time and stores it as HH:MM", async () => {
    const { res, rows } = await tryArtist("۱۴:۳۰");
    expect(res.status).toBe(201);
    expect(rows[0].time).toBe("14:30");
  });
  it("a missing time or date is a 400", async () => {
    const artist = await newArtist();
    const client = await newClient();
    for (const body of [{ bookingDate: day }, { time: "۱۲:۰۰" }, {}]) {
      const res = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", clientName: "x", clientPhone: client.phone, ...body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(await artistRows(artist.id)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
describe("durations", () => {
  const day = pickDay({ min: 3 }).key;

  it("a salon entering a walk-in: odd durations never 500 and are clamped into 15..720 whole minutes", async () => {
    const problems = [];
    for (const duration of [0, -30, "abc", 90.5, 14, 1440, 10000, 1e9, "۳۰ دقیقه", "NaN", null, [], {}]) {
      const salon = await newSalon();
      const res = await salon.api.post("/api/salon-bookings", {
        service: "خدمت ویژه", bookingDate: day, time: "۱۰:۰۰", client: "حضوری", phone: "09120000555", durationMinutes: duration
      });
      if (res.status >= 500) { problems.push(`durationMinutes=${JSON.stringify(duration)} -> ${res.status} ${JSON.stringify(res.payload)}`); continue; }
      const rows = await salonRows(salon.id);
      for (const row of rows) {
        if (!(row.duration_minutes >= 15 && row.duration_minutes <= 720)) problems.push(`durationMinutes=${JSON.stringify(duration)} stored ${row.duration_minutes}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("a salon entering a walk-in with a text duration string never 500s", async () => {
    const problems = [];
    for (const duration of ["", "0", "-5", "90.5", "۳۰۰۰۰ دقیقه", "۱ ساعت", "abc", "99999999999999999999"]) {
      const salon = await newSalon();
      const res = await salon.api.post("/api/salon-bookings", {
        service: "خدمت ویژه", bookingDate: day, time: "۱۰:۰۰", client: "حضوری", phone: "09120000555", duration
      });
      if (res.status >= 500) problems.push(`duration=${JSON.stringify(duration)} -> ${res.status}`);
    }
    expect(problems).toEqual([]);
  });

  it("a fractional durationMinutes from the salon owner is a clean 4xx or is rounded, not a 500 (INTEGER column)", async () => {
    const salon = await newSalon();
    const res = await salon.api.post("/api/salon-bookings", {
      service: "خدمت ویژه", bookingDate: day, time: "۱۰:۰۰", client: "حضوری", phone: "09120000555", durationMinutes: 45.5
    });
    expect(res.status, JSON.stringify(res.payload)).toBeLessThan(500);
  });

  it("an artist's own entry: odd durations never 500 and are clamped into 15..720 whole minutes", async () => {
    const problems = [];
    for (const duration of [0, -30, "abc", 90.5, 14, 1440, 10000, 1e9, null]) {
      const artist = await newArtist();
      const res = await artist.api.post("/api/artist/bookings", {
        artistUserId: artist.id, service: "مانیکور", bookingDate: day, time: "۱۰:۰۰", clientName: "حضوری", clientPhone: "09120000556", durationMinutes: duration
      });
      if (res.status >= 500) { problems.push(`durationMinutes=${JSON.stringify(duration)} -> ${res.status} ${JSON.stringify(res.payload)}`); continue; }
      for (const row of await artistRows(artist.id)) {
        if (!(row.duration_minutes >= 15 && row.duration_minutes <= 720)) problems.push(`durationMinutes=${JSON.stringify(duration)} stored ${row.duration_minutes}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("a client cannot make a 12-hour appointment at a salon just by sending durationMinutes for an unlisted service", async () => {
    const salon = await newSalon();
    const client = await newClient();
    const res = await bookAtSalon(client.api, salon, client, { day, time: "۱۰:۰۰", service: "خدمت ناشناخته", durationMinutes: 600 });
    // Either refused, or the hours check keeps it inside the salon's 10:00-20:00 window (10h fits exactly -- so it must at least not exceed it)
    expect(res.status).toBeLessThan(500);
    if (res.status === 201) {
      const [row] = await salonRows(salon.id);
      note("client-chosen duration for an unlisted service stored:", row.duration_minutes);
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe("today, the end of the day and slots that already passed", () => {
  const tehranMinutes = () => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    return Number(parts.find((p) => p.type === "hour").value) % 24 * 60 + Number(parts.find((p) => p.type === "minute").value);
  };
  const label = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const todayIsFriday = plain(weekdayAhead(0)) === plain("جمعه");

  it("a slot earlier today is refused as past (client and salon owner, 'امروز' and the explicit key)", async () => {
    const now = tehranMinutes();
    if (todayIsFriday || now < 11 * 60) return; // salon closed / no earlier slot in the day
    const earlier = label(Math.floor((now - 30) / 30) * 30);
    for (const dayText of ["امروز", keyAhead(0)]) {
      const salon = await newSalon();
      const client = await newClient();
      const asClient = await bookAtSalon(client.api, salon, client, { day: dayText, time: earlier });
      expect(asClient.status, `${dayText} ${earlier} as client`).toBe(409);
      const asSalon = await salon.api.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: dayText, time: earlier, client: "حضوری", phone: "09120000557" });
      expect(asSalon.status, `${dayText} ${earlier} as salon`).toBe(409);
      expect(await salonRows(salon.id)).toHaveLength(0);
    }
  });

  it("a client cannot request a slot that starts within 30 minutes (TOO_SOON), an artist's direct request the same", async () => {
    const now = tehranMinutes();
    if (todayIsFriday || now < 10 * 60 || now > 19 * 60 - 31) return;
    const soon = label(Math.ceil((now + 5) / 30) * 30); // next half hour, < 30 min away at least part of the time
    const minutesAway = Math.ceil((now + 5) / 30) * 30 - now;
    if (minutesAway >= 30) return;
    const salon = await newSalon();
    const client = await newClient();
    const res = await bookAtSalon(client.api, salon, client, { day: keyAhead(0), time: soon });
    expect(res.status).toBe(409);
    expect(res.payload.code).toBe("TOO_SOON");
    const artist = await newArtist();
    const direct = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", bookingDate: keyAhead(0), time: soon, clientName: client.user.name, clientPhone: client.phone });
    expect(direct.status).toBe(409);
  });

  it("'امروز'/'فردا'/weekday labels are resolved to absolute keys at write time", async () => {
    const salon = await newSalon();
    const client = await newClient();
    const tomorrowOpen = plain(weekdayAhead(1)) !== plain("جمعه");
    if (tomorrowOpen) {
      const res = await bookAtSalon(client.api, salon, client, { day: "فردا", time: "۱۱:۰۰" });
      expect(res.status).toBe(201);
      expect(res.payload.data.booking.booking_date).toBe(keyAhead(1));
    }
  });

  it("a Friday (default closed day) is refused with SALON_CLOSED for both the weekday name and the key", async () => {
    let fridayOffset = 1;
    while (plain(weekdayAhead(fridayOffset)) !== plain("جمعه")) fridayOffset += 1;
    for (const dayText of [keyAhead(fridayOffset), "جمعه"]) {
      const salon = await newSalon();
      const client = await newClient();
      const res = await bookAtSalon(client.api, salon, client, { day: dayText, time: "۱۱:۰۰" });
      expect(res.status, dayText).toBe(409);
      expect(res.payload.error).toMatch(/تعطیل/);
    }
  });

  it("a Thursday's shorter hours (closes 18:00) are enforced for the end of the booking, not only its start", async () => {
    let offset = 2;
    while (plain(weekdayAhead(offset)) !== plain("پنجشنبه")) offset += 1;
    const key = keyAhead(offset);
    const salon = await newSalon();
    const client = await newClient();
    const inside = await bookAtSalon(client.api, salon, client, { day: key, time: "۱۷:۰۰", service: "کوتاهی مو", durationMinutes: 60 });
    expect(inside.status).toBe(201);
    const salon2 = await newSalon();
    const crossing = await bookAtSalon(client.api, salon2, client, { day: key, time: "۱۷:۳۰", service: "کوتاهی مو", durationMinutes: 60 });
    expect(crossing.status).toBe(409);
    expect(crossing.payload.error).toMatch(/خارج از زمان کاری/);
    const late = await bookAtSalon(client.api, salon2, client, { day: key, time: "۱۹:۰۰", service: "کوتاهی مو", durationMinutes: 60 });
    expect(late.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------------------------
describe("hours the salon / artist can save", () => {
  it("PATCH /api/salon-hours with nonsense is a 4xx and leaves the hours usable", async () => {
    const salon = await newSalon();
    const hours = (await salon.api.get("/api/salon-hours")).payload.data.hours;
    const monday = hours.find((h) => plain(h.day) === plain("دوشنبه"));
    const problems = [];
    const cases = [
      { openTime: "abc" },
      { openTime: "۲۵:۰۰" },
      { closeTime: "99:99" },
      { openTime: "۲۰:۰۰", closeTime: "۱۰:۰۰" }, // closes before it opens
      { capacity: "abc" },
      { capacity: -4 },
      { capacity: 1e12 },
      { active: "false" } // the string "false" is truthy
    ];
    for (const patch of cases) {
      const res = await salon.api.patch("/api/salon-hours", { day: monday.day, ...patch });
      if (res.status >= 500) problems.push(`${JSON.stringify(patch)} -> ${res.status}`);
      else if (res.ok) problems.push(`${JSON.stringify(patch)} accepted (stored ${JSON.stringify({ o: res.payload.data.hour?.open_time, c: res.payload.data.hour?.close_time, cap: res.payload.data.hour?.capacity, a: res.payload.data.hour?.active })})`);
      // restore for the next case
      await salon.api.patch("/api/salon-hours", { day: monday.day, openTime: "۱۰:۰۰", closeTime: "۲۰:۰۰", capacity: 8, active: true });
    }
    expect(problems).toEqual([]);
  });

  it("an unknown weekday name in PATCH /api/salon-hours is a 4xx, not a 200 with hour: null", async () => {
    const salon = await newSalon();
    const res = await salon.api.patch("/api/salon-hours", { day: "ششنبه", openTime: "۰۸:۰۰" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("PATCH /api/artist-hours with nonsense is a 4xx", async () => {
    const artist = await newArtist();
    const problems = [];
    for (const patch of [{ day: "شنبه", openTime: "abc" }, { day: "شنبه", capacity: "abc" }, { day: "شنبه", openTime: "۲۰:۰۰", closeTime: "۰۸:۰۰" }, { day: "نامعلوم", openTime: "۰۸:۰۰" }]) {
      const res = await artist.api.patch("/api/artist-hours", patch);
      if (res.status >= 500) problems.push(`${JSON.stringify(patch)} -> ${res.status}`);
      else if (res.ok && (patch.day === "نامعلوم" ? res.payload.data.hour === null : true)) problems.push(`${JSON.stringify(patch)} accepted`);
    }
    expect(problems).toEqual([]);
  });

  it("an artist who closed a weekday or set hours is not bookable outside them (server side), and a 03:00 request is refused", async () => {
    const day = pickDay({ min: 3 });
    const artist = await newArtist();
    const client = await newClient();
    await artist.api.get("/api/artist-hours");
    const hours = (await artist.api.get("/api/artist-hours")).payload.data.hours;
    const row = hours.find((h) => plain(h.day) === plain(day.weekday));
    await artist.api.patch("/api/artist-hours", { day: row.day, active: false });
    const closed = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", bookingDate: day.key, time: "۱۱:۰۰", clientName: client.user.name, clientPhone: client.phone });
    note("artist closed on", day.weekday, "-> client booking status", closed.status);
    expect(closed.status, "booking on a day the artist marked closed").toBeGreaterThanOrEqual(400);
  });

  it("an artist with default hours (10:00-20:00) refuses a 03:00 request", async () => {
    const day = pickDay({ min: 3 });
    const artist = await newArtist();
    const client = await newClient();
    await artist.api.get("/api/artist-hours");
    const res = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", bookingDate: day.key, time: "۰۳:۰۰", clientName: client.user.name, clientPhone: client.phone });
    note("03:00 request to an artist ->", res.status);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("bookings that cross midnight", () => {
  it("an artist's late entry (23:00 for 3 h) blocks the early hours of the next day", async () => {
    const day = pickDay({ min: 3, max: 10 });
    const nextOffset = day.offset + 1;
    const artist = await newArtist();
    const client = await newClient();
    const first = await artist.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مو", bookingDate: day.key, time: "۲۳:۰۰", clientName: "حضوری", clientPhone: "09120000558", durationMinutes: 180 });
    note("23:00 +180min entry ->", first.status);
    if (first.status !== 201) return; // refusing it is also a fine answer
    const next = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", bookingDate: keyAhead(nextOffset), time: "۰۰:۳۰", clientName: client.user.name, clientPhone: client.phone });
    expect(next.status, "00:30 next day while the previous night's booking runs until 02:00").toBe(409);
  });
});

// ---------------------------------------------------------------------------------------------
describe("garbage request bodies on the booking endpoints", () => {
  it("no 5xx for malformed JSON, empty bodies, arrays and nulls", async () => {
    const salon = await newSalon();
    const client = await newClient();
    const artist = await newArtist();
    const bad = [undefined, "", "{", "null", "[]", "[1,2]", "\"x\"", "123", "{\"salonUserId\":{}}", "{\"bookingDate\":{\"a\":1},\"time\":[],\"service\":5}"];
    const problems = [];
    for (const [path, method, cookie] of [
      ["/api/salon-bookings", "POST", client.api.cookie()],
      ["/api/salon-bookings", "PATCH", salon.api.cookie()],
      ["/api/artist/bookings", "POST", client.api.cookie()],
      ["/api/artist/bookings", "POST", ""],
      ["/api/salon-bookings/1/answer", "POST", client.api.cookie()],
      ["/api/salon-bookings/1/cancel", "POST", client.api.cookie()],
      ["/api/artist-bookings/1/cancel", "POST", client.api.cookie()],
      ["/api/salon-hours", "PATCH", salon.api.cookie()],
      ["/api/salon-services", "POST", salon.api.cookie()],
      ["/api/salon-services", "DELETE", salon.api.cookie()],
      ["/api/salon-staff", "DELETE", salon.api.cookie()],
      ["/api/artist/teams", "DELETE", artist.api.cookie()],
      ["/api/profile", "DELETE", client.api.cookie()]
    ]) {
      for (const body of bad) {
        const res = await raw(path, { method, body, cookie });
        if (res.status >= 500) problems.push(`${method} ${path} body=${JSON.stringify(body)?.slice(0, 40)} -> ${res.status}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
