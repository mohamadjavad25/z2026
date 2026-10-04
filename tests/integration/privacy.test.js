import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

describe("public salon payload", () => {
  it("never exposes bookings, client names or client phone numbers", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Private Data Salon" });
    await salonClient.post("/api/salon-services", { name: "کراتین مو", price: "100", duration: "60 دقیقه" });

    const customerClient = createClient();
    const customer = await registerUser(customerClient, { type: "client", name: "Secret Customer" });
    const booked = await customerClient.post("/api/salon-bookings", {
      salonUserId: salon.user.id,
      service: "کراتین مو",
      bookingDate: "شنبه",
      time: "۱۰:۰۰",
      client: "Secret Customer",
      phone: customer.phone
    });
    expect(booked.ok).toBe(true);

    const anon = createClient();
    const res = await anon.get(`/api/salons/${salon.user.id}`);
    expect(res.ok).toBe(true);
    const text = JSON.stringify(res.payload);
    expect(res.payload.data.salon.bookings).toBeUndefined();
    expect(text).not.toContain("Secret Customer");
    expect(text).not.toContain(customer.phone);
  });
});
