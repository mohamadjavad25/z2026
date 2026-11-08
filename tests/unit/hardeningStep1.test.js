import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clockOffsetMs, learnServerTime, nowDate, nowMs, resetClockForTests } from "../../app/shared/lib/clock.js";
import { isKnownPushEndpoint, isSafeToPost } from "../../app/lib/pushEndpoint.js";
import { isRetryableConnectError } from "../../app/lib/db/connection.js";
import { SALON_HOUR_TIME_OPTIONS, buildDayBookingSlots, parseBookingTime, parseClosingTime } from "../../app/shared/lib/time.js";
import { readHoursPatch } from "../../app/lib/validation/hours.js";
import { clockLabel } from "../../app/features/team/teamWeek.js";
import { apiFetch, TIMEOUT_MESSAGE } from "../../app/shared/api/client.js";

const httpDate = (ms) => new Date(ms).toUTCString();

describe("the app's clock follows the server", () => {
  beforeEach(resetClockForTests);
  afterEach(resetClockForTests);

  it("corrects a phone set three days ahead", () => {
    const sentAt = Date.now();
    learnServerTime(httpDate(sentAt - 3 * 24 * 3600 * 1000), sentAt, sentAt + 200);
    expect(clockOffsetMs()).toBeLessThan(-3 * 24 * 3600 * 1000 + 3000);
    expect(Math.abs(nowMs() - (Date.now() - 3 * 24 * 3600 * 1000))).toBeLessThan(3000);
    expect(nowDate()).toBeInstanceOf(Date);
  });

  it("ignores a difference under 90 seconds, and forgets an old offset when the phone is right again", () => {
    const sentAt = Date.now();
    learnServerTime(httpDate(sentAt + 60 * 1000), sentAt, sentAt + 100);
    expect(clockOffsetMs()).toBe(0);
    learnServerTime(httpDate(sentAt + 3600 * 1000), sentAt, sentAt + 100);
    expect(clockOffsetMs()).not.toBe(0);
    learnServerTime(httpDate(sentAt), sentAt, sentAt + 100);
    expect(clockOffsetMs()).toBe(0);
  });

  it("does not learn from a slow reply or a broken header", () => {
    const sentAt = Date.now();
    learnServerTime(httpDate(sentAt + 3600 * 1000), sentAt, sentAt + 31 * 1000);
    expect(clockOffsetMs()).toBe(0);
    learnServerTime("not a date", sentAt, sentAt + 100);
    learnServerTime(httpDate(sentAt + 3600 * 1000), sentAt + 100, sentAt);
    expect(clockOffsetMs()).toBe(0);
  });
});

describe("no request waits forever", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a read that never answers ends with the time-limit message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_path, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    const outcome = apiFetch("/api/slow").then(() => "answered", (error) => error);
    await vi.advanceTimersByTimeAsync(25 * 1000);
    const error = await outcome;
    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe(TIMEOUT_MESSAGE);
  });

  it("the caller's own cancel is still a cancel, not a time limit", async () => {
    vi.stubGlobal("fetch", (_path, init) => new Promise((_resolve, reject) => {
      const stop = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      if (init.signal.aborted) stop();
      init.signal.addEventListener("abort", stop);
    }));
    const controller = new AbortController();
    const outcome = apiFetch("/api/cancelled", { signal: controller.signal }).then(() => "answered", (error) => error);
    controller.abort();
    expect((await outcome).name).toBe("AbortError");
  });
});

describe("which push addresses are kept", () => {
  it("knows the real push services only", () => {
    expect(isKnownPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isKnownPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isKnownPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isKnownPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
    for (const bad of ["http://fcm.googleapis.com/x", "https://127.0.0.1/x", "https://fcm.googleapis.com:8443/x", "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.example/x", "https://evilfcm.googleapis.com.example/x", "not a url", "", null]) {
      expect(isKnownPushEndpoint(bad)).toBe(false);
    }
    expect(isKnownPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(1000)}`)).toBe(false);
  });

  it("never posts to an old row with a raw IP, a local name or plain http", () => {
    expect(isSafeToPost("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    for (const bad of ["http://example.com/x", "https://127.0.0.1/x", "https://[::1]/x", "https://localhost/x", "https://db.internal/x", "https://printer.local/x", "https://intranet/x", ""]) {
      expect(isSafeToPost(bad)).toBe(false);
    }
  });
});

describe("a database that is restarting", () => {
  it("retries a connection that was never made", () => {
    for (const code of ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "57P03", "53300"]) expect(isRetryableConnectError({ code })).toBe(true);
    expect(isRetryableConnectError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isRetryableConnectError(new Error("the database system is starting up"))).toBe(true);
  });

  it("does not retry a full pool or a query that failed", () => {
    expect(isRetryableConnectError(new Error("timeout exceeded when trying to connect"))).toBe(false);
    expect(isRetryableConnectError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isRetryableConnectError(null)).toBe(false);
  });
});

describe("a day from 6:00 to 24:00", () => {
  const rows = [{ day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰" }];

  it("the hours sheet offers 6 through 24", () => {
    expect(SALON_HOUR_TIME_OPTIONS[0]).toBe("۰۶:۰۰");
    expect(SALON_HOUR_TIME_OPTIONS.at(-1)).toBe("۲۴:۰۰");
  });

  it("24:00 is a closing time, never the start of a visit", () => {
    expect(parseClosingTime("۲۴:۰۰")).toBe("24:00");
    expect(parseClosingTime("20:30")).toBe("20:30");
    expect(parseClosingTime("24:30")).toBe("");
    expect(parseClosingTime("25:00")).toBe("");
    expect(parseBookingTime("24:00")).toBe("");
  });

  it("the saved row takes 24:00 as close and refuses it as open", () => {
    expect(readHoursPatch({ day: "شنبه", openTime: "۰۶:۰۰", closeTime: "۲۴:۰۰" }, rows)).toMatchObject({ ok: true, patch: { openTime: "۰۶:۰۰", closeTime: "۲۴:۰۰" } });
    expect(readHoursPatch({ day: "شنبه", openTime: "۲۴:۰۰" }, rows).ok).toBe(false);
  });

  it("the last visit ends exactly at midnight", () => {
    const slots = buildDayBookingSlots("۰۶:۰۰", "۲۴:۰۰", 60);
    expect(slots[0]).toBe("۰۶:۰۰");
    expect(slots.at(-1)).toBe("۲۳:۰۰");
  });

  it("the team sheets can say 24:00", () => {
    expect(clockLabel(24 * 60)).toBe("۲۴:۰۰");
    expect(clockLabel(99999)).toBe("۲۴:۰۰");
  });
});
