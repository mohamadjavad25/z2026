import { describe, it, expect } from "vitest";
import { createRequestBreaker } from "../../app/shared/api/requestBreaker.js";

function breakerWithClock(options) {
  const clock = { time: 1_000 };
  const breaker = createRequestBreaker({ ...options, now: () => clock.time });
  return { breaker, clock };
}

describe("requestBreaker", () => {
  it("lets a healthy endpoint through forever", () => {
    const { breaker, clock } = breakerWithClock();
    for (let i = 0; i < 100; i += 1) {
      expect(breaker.isBlocked("/api/salons")).toBe(false);
      breaker.record("/api/salons", 200);
      clock.time += 100;
    }
  });

  it("blocks a path after repeated 401s inside the window, then recovers after the cooldown", () => {
    const { breaker, clock } = breakerWithClock({ limit: 5, windowMs: 10_000, cooldownMs: 30_000 });
    for (let i = 0; i < 5; i += 1) {
      expect(breaker.isBlocked("/api/salon-hours")).toBe(false);
      breaker.record("/api/salon-hours", 401);
      clock.time += 300;
    }
    expect(breaker.isBlocked("/api/salon-hours")).toBe(true);
    expect(breaker.isBlocked("/api/salon-staff")).toBe(false); // other paths are unaffected
    clock.time += 30_000;
    expect(breaker.isBlocked("/api/salon-hours")).toBe(false);
  });

  it("does not trip on slow, occasional failures (a poller every 20 s)", () => {
    const { breaker, clock } = breakerWithClock({ limit: 5, windowMs: 10_000 });
    for (let i = 0; i < 50; i += 1) {
      breaker.record("/api/salon-bookings", 500);
      clock.time += 20_000;
      expect(breaker.isBlocked("/api/salon-bookings")).toBe(false);
    }
  });

  it("a success resets the failure count", () => {
    const { breaker, clock } = breakerWithClock({ limit: 3, windowMs: 10_000 });
    breaker.record("/api/x", 401);
    breaker.record("/api/x", 401);
    breaker.record("/api/x", 200);
    breaker.record("/api/x", 401);
    breaker.record("/api/x", 401);
    clock.time += 10;
    expect(breaker.isBlocked("/api/x")).toBe(false);
  });

  it("ignores ordinary client errors like 404", () => {
    const { breaker } = breakerWithClock({ limit: 2 });
    for (let i = 0; i < 10; i += 1) breaker.record("/api/x", 404);
    expect(breaker.isBlocked("/api/x")).toBe(false);
  });
});
