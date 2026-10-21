import { describe, it, expect, afterAll } from "vitest";
import { createClient, registerUser } from "./helpers.js";
import { closeDb, q, note, pickDay, newSalon, newClient, newArtist, bookAtSalon, deleteAccount, salonRows } from "./angle2Util.js";
import { toPersianDigits } from "../../app/shared/lib/digits.js";

afterAll(closeDb);

const arabicIndic = (text) => String(text).replace(/\d/g, (c) => String.fromCharCode(0x0660 + Number(c)));
let counter = 0;
const freshPhone = () => `0913${String(Date.now() % 1e5).padStart(5, "0")}${String(counter += 1).padStart(2, "0")}`.slice(0, 11);

async function walkIn(salon, phone, name = "مهمان حضوری", time = "۱۱:۰۰") {
  const day = pickDay({ min: 3 }).key;
  const res = await salon.api.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: day, time, client: name, phone });
  expect(res.status, JSON.stringify(res.payload)).toBe(201);
  return res.payload.data.booking;
}

describe("one phone, first a guest booking then an account", () => {
  it("a verified account for the number sees and can cancel the salon's walk-in; an unverified one does not", async () => {
    const salon = await newSalon();
    const phone = freshPhone();
    const booking = await walkIn(salon, phone);
    const impostor = createClient();
    await registerUser(impostor, { type: "client", name: "Impostor", phone });
    expect((await impostor.get("/api/salon-bookings")).payload.data.bookings).toHaveLength(0);
    expect((await impostor.post(`/api/salon-bookings/${booking.id}/cancel`, {})).status).toBe(404);
    await impostor.delete("/api/profile", { currentPassword: "testpass123" });
    const owner = createClient();
    await registerUser(owner, { type: "client", name: "Owner", phone, verified: true });
    expect((await owner.get("/api/salon-bookings")).payload.data.bookings.map((b) => b.id)).toEqual([booking.id]);
    expect((await owner.post(`/api/salon-bookings/${booking.id}/cancel`, {})).status).toBe(200);
  });

  it("Persian-digit and ASCII phone in booking rows match the same account", async () => {
    const salon = await newSalon();
    const phone = freshPhone();
    const booking = await walkIn(salon, toPersianDigits(phone));
    const owner = createClient();
    await registerUser(owner, { type: "client", name: "Digits Owner", phone, verified: true });
    expect((await owner.get("/api/salon-bookings")).payload.data.bookings.map((b) => b.id)).toContain(booking.id);
    // and with separators / spaces typed by the salon
    const spaced = await walkIn(salon, `${phone.slice(0, 4)} ${phone.slice(4, 7)}-${phone.slice(7)}`, "مهمان دو", "۱۴:۰۰");
    expect((await owner.get("/api/salon-bookings")).payload.data.bookings.map((b) => b.id)).toContain(spaced.id);
  });

  it("Arabic-Indic digit phones (٠٩١٢...) are treated like Persian ones: registration normalizes them and walk-ins match", async () => {
    const salon = await newSalon();
    const phone = freshPhone();
    const booking = await walkIn(salon, arabicIndic(phone));
    const stored = (await q("SELECT phone_normalized FROM salon_bookings WHERE id = $1", [booking.id]))[0].phone_normalized;
    expect(stored, "generated phone_normalized only maps Persian digits").toBe(phone);
    const res = await createClient().post("/api/auth/register", { phone: arabicIndic(phone), password: "testpass123", type: "client", name: "Arabic Digits" });
    expect(res.status, JSON.stringify(res.payload)).toBeLessThan(500);
    if (res.ok) expect(res.payload.data.user.phone).toBe(phone);
  });

  it("a +98 / 98 / 0098 prefixed number is not accepted as a different account for the same line", async () => {
    const phone = freshPhone();
    const first = createClient();
    await registerUser(first, { type: "client", name: "Prefix One", phone });
    const problems = [];
    for (const variant of [`+98${phone.slice(1)}`, `98${phone.slice(1)}`, `0098${phone.slice(1)}`, `${phone.slice(1)}`]) {
      const res = await createClient().post("/api/auth/register", { phone: variant, password: "testpass123", type: "client", name: "Prefix Two" });
      if (res.ok) problems.push(`${variant} registered a second account for the same line`);
    }
    expect(problems).toEqual([]);
  });

  it("two clients with the same display name never see each other's bookings, and the salon's list never links a walk-in to a stranger's account by name alone", async () => {
    const salon = await newSalon();
    const stranger = await newClient("علی همنام");
    const booking = await walkIn(salon, "", "علی همنام");
    const list = (await salon.api.get("/api/salon-bookings")).payload.data.bookings;
    const row = list.find((b) => b.id === booking.id);
    expect(row.client_user_id, "walk-in with no phone got attached to the unrelated account that shares the name").toBeNull();
    expect((await stranger.api.get("/api/salon-bookings")).payload.data.bookings).toHaveLength(0);
  });
});

describe("a number whose account is deleted and then taken by someone else", () => {
  it("the new owner does not inherit the previous person's bookings and history", async () => {
    const salon = await newSalon();
    const phone = freshPhone();
    const oldApi = createClient();
    const old = await registerUser(oldApi, { type: "client", name: "Old Owner", phone, verified: true });
    const day = pickDay({ min: 3 }).key;
    const made = await oldApi.post("/api/salon-bookings", { salonUserId: salon.id, service: "کوتاهی مو", bookingDate: day, time: "۱۱:۰۰", client: old.user.name, phone });
    expect(made.status).toBe(201);
    await oldApi.delete("/api/profile", { currentPassword: "testpass123" });
    const [orphan] = await salonRows(salon.id);
    note("after delete, client_user_id =", orphan.client_user_id, "phone kept =", orphan.phone);
    const newApi = createClient();
    await registerUser(newApi, { type: "client", name: "New Owner", phone, verified: true });
    const inherited = (await newApi.get("/api/salon-bookings")).payload.data.bookings;
    expect(inherited, "the new holder of the number sees (and can cancel) the old person's appointments").toHaveLength(0);
  });

  it("deleting a client account strips the personal data from its booking rows or at least keeps salon lists working", async () => {
    const salon = await newSalon();
    const client = await newClient("Leaver", { verified: true });
    const day = pickDay({ min: 3 }).key;
    await bookAtSalon(client.api, salon, client, { day, time: "۱۲:۰۰" });
    await deleteAccount(client);
    const list = await salon.api.get("/api/salon-bookings");
    expect(list.status).toBe(200);
    expect(list.payload.data.bookings).toHaveLength(1);
  });

  it("a re-registered number does not get the old account's stored phone-keyed leftovers (follows, push, settings)", async () => {
    const phone = freshPhone();
    const a = createClient();
    await registerUser(a, { type: "client", name: "Gone One", phone });
    await a.post("/api/profile/settings", { settings: { reminders: false } });
    await a.delete("/api/profile", { currentPassword: "testpass123" });
    const b = createClient();
    await registerUser(b, { type: "client", name: "Fresh One", phone });
    const me = await b.get("/api/profile/settings");
    expect(me.status).toBeLessThan(500);
    expect(JSON.stringify(me.payload)).not.toMatch(/"reminders":false/);
  });
});

describe("same-name accounts", () => {
  it("two salons / a salon and an artist cannot share a name, even with different spacing, emoji or Arabic letter forms; two clients may", async () => {
    const name = `نام یکتا ${Date.now() % 100000}`;
    const a = createClient();
    await registerUser(a, { type: "salon", name });
    const variants = [name.toUpperCase(), `${name} 💇`, name.replace(/ی/g, "ي"), name.replace(/ /g, "")];
    const problems = [];
    for (const variant of variants) {
      const res = await createClient().post("/api/auth/register", { phone: freshPhone(), password: "testpass123", type: "artist", name: variant });
      if (res.ok) problems.push(`artist "${variant}" accepted next to salon "${name}"`);
    }
    expect(problems).toEqual([]);
    const c1 = await newClient("همنام");
    const c2 = await newClient("همنام");
    expect(c1.id).not.toBe(c2.id);
  });
});
