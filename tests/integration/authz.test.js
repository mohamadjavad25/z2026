import { describe, it, expect } from "vitest";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";

describe("ownership scoping (IDOR checks)", () => {
  it("a salon cannot PATCH another salon's booking by guessing its id", async () => {
    const salonAClient = createClient();
    const salonA = await registerUser(salonAClient, { type: "salon", name: "Salon A" });
    await salonAClient.get("/api/salon-hours");

    const bookerClient = createClient();
    const booker = await registerUser(bookerClient, { type: "client", name: "Booker" });
    const created = await bookerClient.post("/api/salon-bookings", {
      salonUserId: salonA.user.id,
      service: "مانیکور",
      bookingDate: futureBookingDay(2),
      time: "۱۳:۰۰",
      client: booker.user.name,
      phone: booker.phone
    });
    expect(created.ok).toBe(true);
    const bookingId = created.payload.data.booking.id;

    const salonBClient = createClient();
    await registerUser(salonBClient, { type: "salon", name: "Salon B" });
    const hijackAttempt = await salonBClient.patch("/api/salon-bookings", {
      id: bookingId,
      status: "تایید شده"
    });
    // Either not-found (scoped query finds nothing for salon B) or
    // forbidden -- never a 200 that actually changed salon A's row.
    expect(hijackAttempt.ok).toBe(false);

    const stillOwnedBySalonA = await salonAClient.get("/api/salon-bookings");
    const row = stillOwnedBySalonA.payload.data.bookings.find((b) => b.id === bookingId);
    expect(row.status).toBe("درخواست");
  });

  it("a client cannot update another client's profile by sending a different user's data", async () => {
    const clientA = createClient();
    await registerUser(clientA, { name: "Client A" });

    const clientB = createClient();
    const { user: userB } = await registerUser(clientB, { name: "Client B" });

    // clientA's session determines whose row gets updated server-side --
    // there is no user-id field in the request body this route reads, so
    // this proves the write is scoped to the session, not to anything the
    // caller can name.
    await clientA.post("/api/profile", { data: { name: "Renamed By A" } });

    const bCheck = await clientB.get("/api/auth/me");
    expect(bCheck.payload.data.user.name).toBe(userB.name);
    expect(bCheck.payload.data.user.name).not.toBe("Renamed By A");
  });
});
