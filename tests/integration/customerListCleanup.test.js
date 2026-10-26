import { describe, it, expect } from "vitest";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";

// The customers page (owner's decision 2026-10-26): a client who deleted their account is marked, and the salon can
// take a customer with no number off the list without losing the bookings.
describe("customers page: deleted accounts and «از لیست مشتری‌هام بردار»", () => {
  it("marks a deleted client's bookings and hides only the owner's no-number rows", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", menu: true, name: "Cleanup Salon" });
    await salonClient.get("/api/salon-hours");
    const day = futureBookingDay(2);

    const clientApi = createClient();
    const client = await registerUser(clientApi, { type: "client", name: "صدف" });
    const booked = await clientApi.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: day, time: "۱۰:۰۰", client: client.user.name, phone: client.phone
    });
    expect(booked.ok).toBe(true);
    const bookingId = booked.payload.data.booking.id;

    const otherApi = createClient();
    const other = await registerUser(otherApi, { type: "client", name: "مریم" });
    const kept = await otherApi.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: day, time: "۱۲:۰۰", client: other.user.name, phone: other.phone
    });
    expect(kept.ok).toBe(true);

    const del = await clientApi.delete("/api/profile", { currentPassword: "testpass123" });
    expect(del.ok).toBe(true);

    const list = await salonClient.get("/api/salon-bookings");
    const row = list.payload.data.bookings.find((item) => item.id === bookingId);
    expect(row.phone).toBe("");
    expect(row.client_account_deleted_at).toBeTruthy();
    expect(row.customers_hidden_at).toBeFalsy();

    // Someone else's salon cannot touch these rows.
    const strangerApi = createClient();
    await registerUser(strangerApi, { type: "salon", menu: true, name: "Stranger Salon" });
    const stranger = await strangerApi.post("/api/customers/hide", { bookingIds: [bookingId] });
    expect(stranger.payload.data.hidden).toBe(0);

    // A client account cannot use it at all.
    const asClient = await otherApi.post("/api/customers/hide", { bookingIds: [bookingId] });
    expect(asClient.status).toBe(403);

    // The owner hides the deleted customer; a row that still has a number is left alone.
    const hide = await salonClient.post("/api/customers/hide", { bookingIds: [bookingId, kept.payload.data.booking.id] });
    expect(hide.payload.data.hidden).toBe(1);
    const after = await salonClient.get("/api/salon-bookings");
    const rows = after.payload.data.bookings;
    expect(rows.find((item) => item.id === bookingId).customers_hidden_at).toBeTruthy();
    expect(rows.find((item) => item.id === kept.payload.data.booking.id).customers_hidden_at).toBeFalsy();
  });
});
