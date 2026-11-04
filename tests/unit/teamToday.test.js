import { describe, it, expect } from "vitest";
import { memberToday, weekFromHours } from "../../app/features/team/teamWeek.js";
import { getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

// The salon's «پرسنل» tab, owner's screenshot of 2026-11-04 at 21:04: «امروز تا ۲۰ سرکاره» after 20:00, and «سرکاره»
// all day for someone with no hours. A card says «سرکاره» only while it is true.
const at = (tehranClock) => new Date(`2026-11-04T${tehranClock}:00+03:30`);
const member = (hours, extra = {}) => ({ state: "فعال", hours, ...extra });
const todayHours = (from) => [{ day: getPersianWeekday(from), active: true, open: "10:00", close: "20:00" }];
const say = (person, from) => memberToday(person, weekFromHours(person.hours, from), from);

describe("a team member's day on the salon's «پرسنل» tab", () => {
  it("after the hours it says the day is over, not «سرکاره»", () => {
    const from = at("21:04");
    const today = say(member(todayHours(from)), from);
    expect(today.text).toBe("امروز ۱۰ تا ۲۰ بود؛ تموم شد");
    expect(today).toMatchObject({ today: true, now: false });
  });

  it("before the hours it says when she comes", () => {
    const from = at("09:00");
    expect(say(member(todayHours(from)), from)).toMatchObject({ text: "امروز از ۱۰ میاد", today: true, now: false });
  });

  it("inside the hours she is at work, until the close", () => {
    const from = at("12:00");
    expect(say(member(todayHours(from)), from)).toMatchObject({ tone: "ok", text: "الان سرکاره، تا ۲۰", today: true, now: true });
  });

  it("someone with no hours set is never «سرکاره»", () => {
    const from = at("12:00");
    expect(say(member([]), from)).toMatchObject({ tone: "warn", text: "ساعت کاریش رو نذاشته", today: false, now: false });
  });

  it("a day she does not work says so", () => {
    const from = at("12:00");
    const other = getPersianWeekday(new Date(from.getTime() + 86400000));
    expect(say(member([{ day: other, active: true, open: "10:00", close: "20:00" }]), from)).toMatchObject({ text: "امروز نمیاد", today: false });
  });

  it("an hour off inside the day: away during it, at work around it", () => {
    const leaves = [{ from: "0000-00-00", to: "9999-99-99", start: "12:00", end: "14:00" }];
    const during = at("13:00");
    expect(say(member(todayHours(during), { leaves }), during)).toMatchObject({ text: "امروز از ۱۲ تا ۱۴ نیست", now: false });
    const after = at("15:00");
    expect(say(member(todayHours(after), { leaves }), after)).toMatchObject({ tone: "ok", now: true });
  });

  it("a salon leave wins over the hours", () => {
    const from = at("12:00");
    expect(say(member(todayHours(from), { state: "مرخصی" }), from)).toMatchObject({ tone: "leave", now: false, today: false });
  });
});
