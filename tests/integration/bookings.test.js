import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

async function setupSalonAndClient() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Test Salon" });
  // GET /api/salon-hours auto-creates the default weekly schedule
  // (ensureSalonHours) the first time it's read for a new salon.
  await salonClient.get("/api/salon-hours");

  const bookerClient = createClient();
  const booker = await registerUser(bookerClient, { type: "client", name: "Booker" });
  return { salonClient, salon, bookerClient, booker };
}

describe("salon bookings", () => {
  it("creates a booking that always starts as تازه, even if the caller tries to inject a confirmed status", async () => {
    const { bookerClient, salon, booker } = await setupSalonAndClient();
    const res = await bookerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "کوتاهی مو",
      bookingDate: "شنبه",
      time: "۱۰:۰۰",
      client: booker.user.name,
      phone: booker.phone,
      status: "تایید شده" // attempted injection -- must be ignored server-side
    });
    expect(res.ok).toBe(true);
    expect(res.payload.data.booking.status).toBe("تازه");
  });

  it("rejects a second booking that overlaps an already-booked slot", async () => {
    const { bookerClient, salon, booker } = await setupSalonAndClient();
    const first = await bookerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "کوتاهی مو",
      bookingDate: "یکشنبه",
      time: "۱۱:۰۰",
      client: booker.user.name,
      phone: booker.phone
    });
    expect(first.ok).toBe(true);

    const secondBookerClient = createClient();
    const secondBooker = await registerUser(secondBookerClient, { type: "client", name: "Booker 2" });
    const second = await secondBookerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "کوتاهی مو",
      bookingDate: "یکشنبه",
      time: "۱۱:۰۰",
      client: secondBooker.user.name,
      phone: secondBooker.phone
    });
    expect(second.status).toBe(409);
  });

  it("lets the owning salon confirm a booking via PATCH", async () => {
    const { bookerClient, salonClient, salon, booker } = await setupSalonAndClient();
    const created = await bookerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "رنگ مو",
      bookingDate: "دوشنبه",
      time: "۱۲:۰۰",
      client: booker.user.name,
      phone: booker.phone
    });
    expect(created.ok).toBe(true);

    const confirmed = await salonClient.patch("/api/salon-bookings", {
      id: created.payload.data.booking.id,
      status: "تایید شده"
    });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.payload.data.booking.status).toBe("تایید شده");
  });
});

describe("booking service icon snapshot", () => {
  it("stamps the salon service's chosen icon on the booking, and keeps it if the service is renamed", async () => {
    const { bookerClient, salonClient, salon, booker } = await setupSalonAndClient();
    const svc = await salonClient.post("/api/salon-services", {
      name: "ژلیش ویژه",
      price: "۱۰۰",
      duration: "۶۰ دقیقه",
      emoji: "gem"
    });
    expect(svc.status).toBe(201);

    const created = await bookerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "ژلیش ویژه",
      bookingDate: "سه‌شنبه",
      time: "۱۴:۰۰",
      client: booker.user.name,
      phone: booker.phone
    });
    expect(created.ok).toBe(true);
    expect(created.payload.data.booking.service_emoji).toBe("gem");

    // Renaming the service later must not rewrite history.
    const renamed = await salonClient.patch("/api/salon-services", {
      id: svc.payload.data.service.id,
      name: "ژلیش جدید",
      emoji: "heart"
    });
    expect(renamed.ok).toBe(true);
    const list = await salonClient.get("/api/salon-bookings");
    const row = list.payload.data.bookings.find((item) => item.id === created.payload.data.booking.id);
    expect(row.service_emoji).toBe("gem");
  });

  it("falls back to an empty icon (never an invalid id) when the service has none", async () => {
    const { bookerClient, salon, booker } = await setupSalonAndClient();
    const created = await bookerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "خدمت ناشناخته",
      bookingDate: "چهارشنبه",
      time: "۱۵:۰۰",
      client: booker.user.name,
      phone: booker.phone,
      serviceEmoji: "<script>"
    });
    expect(created.ok).toBe(true);
    expect(created.payload.data.booking.service_emoji).toBe("");
  });
});

describe("client cancels own booking", () => {
  it("only the booking's client can cancel; the salon sees it cancelled and the slot frees up", async () => {
    const { salonClient, salon, bookerClient, booker } = await setupSalonAndClient();
    const created = await bookerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "کوتاهی مو",
      bookingDate: "شنبه",
      time: "۱۰:۰۰",
      client: booker.user.name,
      phone: booker.phone
    });
    expect(created.ok).toBe(true);
    const id = created.payload.data.booking.id;

    // Someone else cannot cancel it; neither can the salon through the client route.
    const stranger = createClient();
    await registerUser(stranger, { type: "client", name: "Stranger" });
    expect((await stranger.post(`/api/salon-bookings/${id}/cancel`, {})).status).toBe(404);
    expect((await salonClient.post(`/api/salon-bookings/${id}/cancel`, {})).status).toBe(403);
    expect((await bookerClient.post("/api/salon-bookings/abc/cancel", {})).status).toBe(404);

    const cancelled = await bookerClient.post(`/api/salon-bookings/${id}/cancel`, {});
    expect(cancelled.ok).toBe(true);
    expect(cancelled.payload.data.booking.status).toBe("لغو");

    const salonList = await salonClient.get("/api/salon-bookings");
    expect(salonList.payload.data.bookings.find((b) => b.id === id).status).toBe("لغو");

    // Already cancelled -> no longer active.
    expect((await bookerClient.post(`/api/salon-bookings/${id}/cancel`, {})).status).toBe(409);

    // The slot is free again for someone else.
    const other = createClient();
    const otherUser = await registerUser(other, { type: "client", name: "Other" });
    const rebook = await other.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "کوتاهی مو",
      bookingDate: "شنبه",
      time: "۱۰:۰۰",
      client: otherUser.user.name,
      phone: otherUser.phone
    });
    expect(rebook.ok).toBe(true);
  });
});
