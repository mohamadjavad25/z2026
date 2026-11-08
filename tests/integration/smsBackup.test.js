import { describe, it, expect, afterAll } from "vitest";
import { closeDb, q, newSalon, cron, keyAhead } from "./angle2Util.js";

// The SMS backup on the real database (owner, 2026-11-08; bookingSms.js sendDueSmsBackups): the 5-minute sweep sends a
// held booking SMS only when its ten minutes are up, the person has not opened frfro since, and the booking still
// has the status it had when the notice went. Each held SMS is settled once.
afterAll(closeDb);

async function booking(salonId, status) {
  const [row] = await q(`
    INSERT INTO salon_bookings (salon_user_id, client, phone, service, booking_date, time, duration_minutes, status)
    VALUES ($1, 'Backup Client', '09130000000', 'کوتاهی مو', $2, '10:00', 60, $3) RETURNING id
  `, [salonId, keyAhead(3), status]);
  return row.id;
}

async function hold(userId, bookingId, { status = "درخواست", minutesAgo = 11 } = {}) {
  const [row] = await q(`
    INSERT INTO sms_backups (user_id, template, sms_values, booking_kind, booking_id, booking_status, booking_date, booking_time, created_at, due_at)
    VALUES ($1, 'booking_request', '{"who":"مینا","day":"فردا","time":"۱۰:۰۰"}', 'salon', $2, $3, $4, '10:00',
      NOW() - $5::int * INTERVAL '1 minute', NOW() - ($5::int - 10) * INTERVAL '1 minute') RETURNING id
  `, [userId, bookingId, status, keyAhead(3), minutesAgo]);
  return row.id;
}

const outcome = async (id) => (await q("SELECT outcome, settled_at FROM sms_backups WHERE id = $1", [id]))[0];

describe("held booking SMS", () => {
  it("sends, skips or waits, and never settles one twice", async () => {
    const salon = await newSalon(`Backup ${Date.now() % 100000}`);
    await q("UPDATE users SET last_seen_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [salon.id]);

    const waiting = await hold(salon.id, await booking(salon.id, "درخواست"));
    const answered = await hold(salon.id, await booking(salon.id, "تایید شده"));
    const early = await hold(salon.id, await booking(salon.id, "درخواست"), { minutesAgo: 3 });

    const first = await cron("expire-bookings", {});
    expect(first.status).toBe(200);
    expect((await outcome(waiting)).outcome).toBe("sent");
    expect((await outcome(answered)).outcome).toBe("changed");
    expect((await outcome(early)).settled_at).toBeNull();

    const again = await cron("expire-bookings", {});
    expect(again.status).toBe(200);
    expect((await outcome(waiting)).outcome).toBe("sent");
  });

  it("someone who opened frfro after the notice gets no SMS", async () => {
    const salon = await newSalon(`Backup seen ${Date.now() % 100000}`);
    const id = await hold(salon.id, await booking(salon.id, "درخواست"));
    await q("UPDATE users SET last_seen_at = NOW() WHERE id = $1", [salon.id]);
    await cron("expire-bookings", {});
    expect((await outcome(id)).outcome).toBe("seen");
  });
});
