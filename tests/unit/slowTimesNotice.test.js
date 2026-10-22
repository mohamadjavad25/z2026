import { describe, it, expect } from "vitest";
import { slowLevel, SLOW_TEXT, BUSY_TEXT } from "../../app/features/booking/SlowTimesNotice.jsx";

describe("slow times notice", () => {
  it("says nothing before 3 s, «slow» from 3 s, «busy» from 10 s", () => {
    expect(slowLevel(0)).toBe(0);
    expect(slowLevel(2999)).toBe(0);
    expect(slowLevel(3000)).toBe(1);
    expect(slowLevel(9999)).toBe(1);
    expect(slowLevel(10000)).toBe(2);
  });
  it("uses the owner's approved texts", () => {
    expect(SLOW_TEXT).toBe("ساعت‌ها دیر می‌آیند؛ دارم دوباره امتحان می‌کنم");
    expect(BUSY_TEXT).toBe("الان شلوغ است. چند لحظهٔ دیگر");
  });
});
