import { describe, it, expect } from "vitest";
import {
  buildBookingCustomers, buildSharedPhoneLookup, customerMatchesQuery, describeFollowTime, findNameConflict, phoneKey, pickFreshFollowers, sharedPhoneLabel
} from "../../app/features/salons/customers";

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
    expect(customer.name).toBe("مشتری تازه");
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

describe("deleted accounts and removed customers", () => {
  it("marks a deleted account apart from a walk-in with the same name, and skips removed bookings", () => {
    const list = buildBookingCustomers([
      { id: 5, client: "صدف", phone: "", client_account_deleted_at: "2026-10-26T10:00:00Z", status: "تایید شده", date: "امروز" },
      { id: 4, client: "صدف", phone: "", status: "تازه", date: "فردا" },
      { id: 3, client: "نازنین", phone: "", status: "تازه", date: "فردا", customers_hidden_at: "2026-10-26T10:00:00Z" },
      { id: 2, client: "مریم", phone: "09121234567", status: "تازه", date: "فردا" }
    ]);
    expect(list).toHaveLength(3);
    const deleted = list.find((c) => c.accountDeleted);
    expect(deleted.name).toBe("صدف");
    expect(deleted.removable).toBe(true);
    const walkIn = list.find((c) => c.name === "صدف" && !c.accountDeleted);
    expect(walkIn.removable).toBe(true);
    expect(list.find((c) => c.name === "مریم").removable).toBe(false);
    expect(list.some((c) => c.name === "نازنین")).toBe(false);
  });
});

// Owner's decision 2026-10-31: one phone, several names. The customers list keeps ONE card per number, remembers every
// name on it, finds the card by any of them, and the booking form asks before a new name is saved for a known number.
describe("one phone with several names", () => {
  const sara = { id: 1, client: "سارا", phone: "09121234567", status: "تازه", date: "فردا", service: "کوتاهی" };
  const maryam = { id: 2, client: "مریم", phone: "+989121234567", status: "تازه", date: "فردا", service: "رنگ" };

  it("keeps one card with both names, each with its own count (bug seen 2026-10-30: the first name vanished)", () => {
    const list = buildBookingCustomers([maryam, sara]);
    expect(list).toHaveLength(1);
    const [card] = list;
    expect(card.names.map((item) => item.name)).toEqual(["مریم", "سارا"]);
    expect(card.otherNames).toEqual(["سارا"]);
    expect(card.names.map((item) => item.visitCount)).toEqual([1, 1]);
    expect(card.bookings).toHaveLength(2);
  });

  it("main name: the one used most, the newest on a tie", () => {
    const again = { ...sara, id: 3 };
    expect(buildBookingCustomers([maryam, again, sara])[0].name).toBe("سارا");
    expect(buildBookingCustomers([maryam, sara])[0].name).toBe("مریم");
  });

  it("main name: the account's own name wins over what was typed", () => {
    const linked = { id: 4, client: "سارا", phone: "09121234567", client_user_id: 9, client_account_name: "سارا", status: "تایید شده", date: "امروز" };
    const typed = { id: 5, client: "مریم", phone: "09121234567", status: "تازه", date: "فردا" };
    const [card] = buildBookingCustomers([typed, linked]);
    expect(card.name).toBe("سارا");
    expect(card.accountName).toBe("سارا");
    expect(card.otherNames).toEqual(["مریم"]);
  });

  it("a number that only matches an account's phone does not turn a typed name into the account's name", () => {
    const typed = { id: 6, client: "دختر", phone: "09121234567", client_user_id: 9, client_account_name: "مادر", status: "تازه", date: "فردا" };
    const [card] = buildBookingCustomers([typed]);
    expect(card.name).toBe("مادر");
    expect(card.names.map((item) => item.name)).toEqual(["مادر", "دختر"]);
    const [plain] = buildBookingCustomers([{ ...typed, client_account_name: "" }]);
    expect(plain.name).toBe("دختر");
    expect(plain.accountName).toBe("");
  });

  it("a follower's account name is the main name too", () => {
    const [card] = buildBookingCustomers([maryam], [{ userId: 8, name: "سارا", phone: "09121234567", followedAt: new Date().toISOString(), hasBooked: true }]);
    expect(card.name).toBe("سارا");
    expect(card.names.map((item) => item.name)).toEqual(["سارا", "مریم"]);
  });

  it("spaces, Arabic letters and case do not make a second name, «مریم جون» does", () => {
    const spaced = { ...sara, id: 6, client: " س ارا " };
    const arabic = { ...maryam, id: 7, client: "مريم" };
    expect(buildBookingCustomers([sara, spaced])[0].names).toHaveLength(1);
    expect(buildBookingCustomers([maryam, arabic])[0].names).toHaveLength(1);
    expect(buildBookingCustomers([maryam, { ...maryam, id: 8, client: "مریم جون" }])[0].names).toHaveLength(2);
  });

  it("the same name on two different numbers stays two customers", () => {
    const list = buildBookingCustomers([sara, { ...sara, id: 9, phone: "09129999999" }]);
    expect(list).toHaveLength(2);
    expect(list.every((card) => card.names.length === 1)).toBe(true);
  });

  it("search finds the card by either name or the number", () => {
    const [card] = buildBookingCustomers([maryam, sara]);
    expect(customerMatchesQuery(card, "سارا")).toBe(true);
    expect(customerMatchesQuery(card, "مریم")).toBe(true);
    expect(customerMatchesQuery(card, "۹۱۲۱۲۳")).toBe(true);
    expect(customerMatchesQuery(card, "علی")).toBe(false);
    expect(customerMatchesQuery(card, "")).toBe(true);
  });

  it("a cancelled booking still keeps its name on the card", () => {
    const [card] = buildBookingCustomers([{ ...maryam, status: "لغو" }, sara]);
    expect(card.names.map((item) => item.name).sort()).toEqual(["سارا", "مریم"]);
    expect(card.names.find((item) => item.name === "مریم").cancelled).toBe(1);
  });
});

describe("findNameConflict (the question before a booking is saved)", () => {
  const [saraCard] = buildBookingCustomers([{ id: 1, client: "سارا", phone: "09121234567", status: "تازه", date: "فردا" }]);
  const [accountCard] = buildBookingCustomers([{ id: 2, client: "سارا", phone: "09121234567", client_user_id: 4, client_account_name: "سارا", status: "تایید شده", date: "فردا" }]);

  it("asks when a known number gets a new name", () => {
    expect(findNameConflict([saraCard], "۰۹۱۲۱۲۳۴۵۶۷", "مریم")).toMatchObject({ type: "ask", mainName: "سارا", names: ["سارا"], typed: "مریم" });
    expect(findNameConflict([saraCard], "+989121234567", " مریم جون ")).toMatchObject({ type: "ask", typed: "مریم جون" });
  });

  it("does not ask for the same name (however it is spelled), a new number, no number or no name", () => {
    expect(findNameConflict([saraCard], "09121234567", "سارا")).toBeNull();
    expect(findNameConflict([saraCard], "09121234567", " س ارا")).toBeNull();
    expect(findNameConflict([saraCard], "09120000000", "مریم")).toBeNull();
    expect(findNameConflict([saraCard], "", "مریم")).toBeNull();
    expect(findNameConflict([saraCard], "0912", "مریم")).toBeNull();
    expect(findNameConflict([saraCard], "09121234567", "  ")).toBeNull();
    expect(findNameConflict([], "09121234567", "مریم")).toBeNull();
  });

  it("does not ask when the second name was already saved for this number", () => {
    const [both] = buildBookingCustomers([
      { id: 1, client: "سارا", phone: "09121234567", status: "تازه", date: "فردا" },
      { id: 2, client: "مریم", phone: "09121234567", status: "تازه", date: "فردا" }
    ]);
    expect(findNameConflict([both], "09121234567", "مریم")).toBeNull();
  });

  it("a number that belongs to an account takes the account's name: no question", () => {
    expect(findNameConflict([accountCard], "09121234567", "مریم")).toMatchObject({ type: "account", accountName: "سارا", typed: "مریم" });
  });

  it("a deleted account's number is not matched", () => {
    const [deleted] = buildBookingCustomers([{ id: 3, client: "سارا", phone: "", client_account_deleted_at: "2026-10-26T10:00:00Z", status: "تایید شده", date: "امروز" }]);
    expect(findNameConflict([deleted], "09121234567", "مریم")).toBeNull();
  });
});

describe("«هم‌شماره با …» on the bookings list", () => {
  it("names the other people booked with the same number, and nothing for a number used by one name", () => {
    const rows = [
      { id: 1, client: "سارا", phone: "09121234567" },
      { id: 2, client: "مریم", phone: "+989121234567" },
      { id: 3, client: "علی", phone: "09125550000" },
      { id: 4, client: "سارا", phone: "۰۹۱۲۱۲۳۴۵۶۷" }
    ];
    const lookup = buildSharedPhoneLookup(rows);
    expect(lookup(rows[0])).toEqual(["مریم"]);
    expect(lookup(rows[1])).toEqual(["سارا"]);
    expect(lookup(rows[3])).toEqual(["مریم"]);
    expect(lookup(rows[2])).toEqual([]);
    expect(lookup({ client: "نامشخص", phone: "" })).toEqual([]);
  });

  it("does not count a booking the owner took off the list, or a booking without a number", () => {
    const rows = [
      { id: 1, client: "سارا", phone: "09121234567" },
      { id: 2, client: "مریم", phone: "09121234567", customers_hidden_at: "2026-10-26T10:00:00Z" },
      { id: 3, client: "علی", phone: "" }
    ];
    const lookup = buildSharedPhoneLookup(rows);
    expect(lookup(rows[0])).toEqual([]);
    expect(lookup(rows[2])).toEqual([]);
  });

  it("writes the tag in plain Persian", () => {
    expect(sharedPhoneLabel([])).toBe("");
    expect(sharedPhoneLabel(["سارا"])).toBe("هم‌شماره با سارا");
    expect(sharedPhoneLabel(["سارا", "علی"])).toBe("هم‌شماره با سارا و علی");
    expect(sharedPhoneLabel(["سارا", "علی", "نگار", "مینا"])).toBe("هم‌شماره با سارا و ۳ نفر دیگه");
  });

  it("phoneKey stays the one rule", () => {
    expect(phoneKey("۰۹۱۲۱۲۳۴۵۶۷")).toBe(phoneKey("+989121234567"));
  });
});
