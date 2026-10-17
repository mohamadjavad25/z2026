import { describe, it, expect } from "vitest";
import { buildBookingCustomers, describeFollowTime, phoneKey, pickFreshFollowers } from "../../app/features/salons/customers";

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

describe("followers as contacts", () => {
  const now = new Date();
  const minutesAgo = (n) => new Date(now.getTime() - n * 60 * 1000).toISOString();

  it("makes a follower who has not booked a customer flagged noBookingYet", () => {
    const list = buildBookingCustomers([], [
      { userId: 5, name: "نگار", phone: "09121112233", followedAt: minutesAgo(5), isNew: true, hasBooked: false }
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "نگار", isFollower: true, isNewFollower: true, noBookingYet: true, visitCount: 0, followedToday: true });
    expect(list[0].bookings).toEqual([]);
  });

  it("merges a follower into the customer who booked under the same phone", () => {
    const list = buildBookingCustomers(
      [{ id: 1, client: "نگار", phone: "09121112233", status: "تایید شده", date: "امروز", service: "رنگ" }],
      [{ userId: 5, name: "نگار", phone: "+989121112233", followedAt: minutesAgo(90), isNew: false, hasBooked: true }]
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ isFollower: true, noBookingYet: false, visitCount: 1 });
  });

  it("trusts the server's hasBooked when the booking is outside the loaded list", () => {
    const [customer] = buildBookingCustomers([], [{ userId: 6, name: "سارا", phone: "09124445566", followedAt: minutesAgo(30), isNew: false, hasBooked: true }]);
    expect(customer.noBookingYet).toBe(false);
  });

  it("falls back to a placeholder name and the account id when the follower has no name or phone", () => {
    const [customer] = buildBookingCustomers([], [{ userId: 9, name: "", phone: "", followedAt: minutesAgo(1), isNew: true, hasBooked: false }]);
    expect(customer.name).toBe("مشتری جدید");
    expect(customer.key).toBe("id:9");
  });

  it("picks today's followers and anyone still unseen, newest first", () => {
    const longAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const list = buildBookingCustomers([], [
      { userId: 1, name: "قدیمی دیده‌شده", phone: "09120000011", followedAt: longAgo, isNew: false, hasBooked: false },
      { userId: 2, name: "قدیمی دیده‌نشده", phone: "09120000012", followedAt: longAgo, isNew: true, hasBooked: false },
      { userId: 3, name: "امروز", phone: "09120000013", followedAt: minutesAgo(3), isNew: false, hasBooked: false }
    ]);
    expect(pickFreshFollowers(list).map((c) => c.name)).toEqual(["امروز", "قدیمی دیده‌نشده"]);
  });
});

describe("describeFollowTime", () => {
  const now = new Date("2026-10-17T10:00:00.000Z");
  it("speaks in plain words", () => {
    expect(describeFollowTime(new Date(now.getTime() - 20 * 1000).toISOString(), now)).toBe("همین الان");
    expect(describeFollowTime(new Date(now.getTime() - 12 * 60 * 1000).toISOString(), now)).toBe("۱۲ دقیقه پیش");
    expect(describeFollowTime(new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), now)).toMatch(/^امروز ساعت /);
    expect(describeFollowTime(new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(), now)).toBe("دیروز");
    expect(describeFollowTime("", now)).toBe("");
  });
});
