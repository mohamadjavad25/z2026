import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatPersianDateKey, resolveRollingPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { parseServiceDurationMinutes, timeLabelToMinutes } from "../../app/shared/lib/time.js";
import { ATTEND_NOTICE } from "../../app/shared/lib/attendance.js";
import { clientBookingDays } from "../../app/features/artist/constants.js";
import { BookingSlotPicker } from "../../app/components/BookingSlotPicker.jsx";
import { WaitlistButton } from "../../app/features/booking/WaitlistButton.jsx";
import { PublicArtistBookingPanel, artistDayStates } from "../../app/features/artist/PublicArtistBookingPanel.jsx";

// The story asks the public artist API; here it answers with `storyArtist`.
let storyArtist = null;
vi.mock("../../app/shared/api/artists.js", () => ({ getArtist: async () => ({ ok: true, data: { artist: storyArtist } }) }));
const { loadFreeSlots } = await import("../../app/features/profile/InstagramStorySheet.jsx");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
/** Every weekday 09:00 to 12:00, but `off` days closed. */
const hours = (off = []) => WEEK.map((day) => (off.includes(day)
  ? { day, open_time: "", close_time: "", active: 0 }
  : { day, open_time: "۰۹:۰۰", close_time: "۱۲:۰۰", active: 1 }));
const keyIn = (days) => formatPersianDateKey(new Date(Date.now() + days * DAY_MS));
const morningTaken = (key) => [{ booking_date: key, time: "۰۹:۰۰", duration_minutes: 180, status: "تایید شده" }];
const SERVICE = { id: "s1", name: "لاک ژل", duration: "۶۰ دقیقه", price: "۴۵۰۰۰۰" };

describe("the artist's day strip (booking sheet)", () => {
  const day = keyIn(3);

  it("a day with a free time is open", () => {
    expect(artistDayStates({ hours: hours() }, [day], 60)[day]).toBe("open");
  });

  it("a working day whose every time is booked is full (tappable, for «خبرم کن»), not closed", () => {
    expect(artistDayStates({ hours: hours(), bookedSlots: morningTaken(day) }, [day], 60)[day]).toBe("full");
  });

  it("a day the artist does not work, or is on leave all day, is closed, never full", () => {
    const allOff = hours(WEEK);
    expect(artistDayStates({ hours: allOff }, [day], 60)[day]).toBe("closed");
    expect(artistDayStates({ hours: hours(), leaves: [{ from: day, to: day }] }, [day], 60)[day]).toBe("closed");
  });

  it("the strip keeps a full day tappable and greyed with «پر», a closed one disabled with «تعطیل»", () => {
    const html = renderToStaticMarkup(createElement(BookingSlotPicker, {
      dayOptions: ["امروز ۱ آبان", "شنبه ۲ آبان", "یکشنبه ۳ آبان"],
      dayValue: "شنبه ۲ آبان",
      closedDays: ["یکشنبه ۳ آبان"],
      fullDays: ["شنبه ۲ آبان"],
      emptyTime: createElement("p", { className: "probe" }, "جای «خبرم کن»")
    }));
    const buttons = html.match(/<button[^>]*class="bspDay[^"]*"[^>]*>.*?<\/button>/g);
    expect(buttons[1]).toContain("is-full");
    expect(buttons[1]).not.toContain("disabled");
    expect(buttons[1]).toContain("پر");
    expect(buttons[2]).toContain("disabled");
    expect(buttons[2]).toContain("تعطیل");
    // No hours on the picked day: the sheet's own content takes the hours' place.
    expect(html).toContain("جای «خبرم کن»");
    expect(html).not.toContain("bspEmpty");
  });
});

describe("the booking sheet says less (owner, 2026-11-04)", () => {
  const render = (artist, bookingDay) => renderToStaticMarkup(createElement(PublicArtistBookingPanel, {
    artist,
    services: [SERVICE],
    selectedServiceId: SERVICE.id,
    bookingDay,
    bookingSlot: "",
    parseDuration: parseServiceDurationMinutes,
    onDayChange: () => {},
    onSlotChange: () => {}
  }));

  it("drops the extra notes, the old full-days list and «خدمت انتخاب‌شده»", () => {
    const html = render({ id: 7, name: "آیلین مهرآرا", hours: hours() }, clientBookingDays()[2]);
    for (const gone of ["تا کار تموم نشه", "روزی که می‌خوای پره", "خدمت انتخاب‌شده", "انتخاب‌هات سر جاشه"]) {
      expect(html).not.toContain(gone);
    }
    // The attendance line moved out of the hours, under «بفرست» (PublicArtistModal; the browser test checks it there).
    expect(html).not.toContain(ATTEND_NOTICE);
    expect(html).toContain("لاک ژل");
  });

  it("a picked full day says it is full and offers only the button", () => {
    const label = clientBookingDays()[2];
    const key = resolveRollingPersianDateKey(label);
    const html = render({ id: 7, name: "آیلین مهرآرا", hours: hours(), bookedSlots: morningTaken(key) }, label);
    expect(html).toContain(`${label.split(" ")[0]} پره.`);
    expect(html).toContain("اگه جا باز شد خبرم کن");
    expect(html).not.toContain("پره؟ خبرت می‌کنیم.");
    expect(html).not.toContain("bspTime");
  });

  it("the full «خبرم کن» elsewhere (a salon's form) keeps its words", () => {
    const html = renderToStaticMarkup(createElement(WaitlistButton, { kind: "salon", ownerId: 3, day: keyIn(2), services: [{ name: "مو", minutes: 60 }] }));
    expect(html).toContain("پره؟ خبرت می‌کنیم.");
    expect(html).toContain(">خبرم کن<");
  });
});

describe("the story's free times (lesson 2026-11-04)", () => {
  it("are only inside the artist's working hours, the same times the booking sheet offers", async () => {
    storyArtist = { id: 9, isPublic: true, hours: hours(), services: [{ name: "لاک ژل", duration: "۶۰ دقیقه" }], bookedSlots: [], leaves: [] };
    const days = await loadFreeSlots("artist", 9);
    const tomorrow = days[1];
    expect(tomorrow.times.length).toBeGreaterThan(0);
    // 09:00 to 12:00 with an hour's visit: the last start is 11:00; nothing in the evening.
    expect(Math.max(...tomorrow.times.map(timeLabelToMinutes))).toBe(11 * 60);
    expect(Math.min(...tomorrow.times.map(timeLabelToMinutes))).toBe(9 * 60);
  });

  it("offer nothing on a day the artist does not work", async () => {
    storyArtist = { id: 9, isPublic: true, hours: hours(WEEK), services: [{ name: "لاک ژل", duration: "۶۰ دقیقه" }] };
    const days = await loadFreeSlots("artist", 9);
    expect(days.every((day) => day.times.length === 0)).toBe(true);
  });
});
