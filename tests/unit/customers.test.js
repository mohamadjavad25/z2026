import { describe, it, expect } from "vitest";
import { buildBookingCustomers, phoneKey } from "../../app/features/salons/customers";

describe("buildBookingCustomers", () => {
  it("normalizes phones across formats", () => {
    expect(phoneKey("۰۹۱۲۱۲۳۴۵۶۷")).toBe("9121234567");
    expect(phoneKey("+989121234567")).toBe("9121234567");
  });

  it("merges a walk-in and a registered account by phone and counts statuses", () => {
    const list = buildBookingCustomers([
      { id: 3, client: "سارا", phone: "09121234567", client_user_id: 7, status: "لغو", date: "امروز", service: "کوتاهی" },
      { id: 2, client: "سارا", phone: "+989121234567", status: "تازه", date: "فردا", service: "رنگ" },
      { id: 1, client: "سارا", phone: "۰۹۱۲۱۲۳۴۵۶۷", status: "تایید شده", date: "امروز", service: "کوتاهی" },
      { id: 4, client: "علی", status: "تازه", date: "فردا", service: "ریش" }
    ]);
    expect(list).toHaveLength(2);
    const sara = list.find((c) => c.name === "سارا");
    expect(sara.cancelled).toBe(1);
    expect(sara.visitCount).toBe(2);
    expect(sara.upcoming).toBe(2);
    expect(sara.bookings).toHaveLength(3);
  });
});
