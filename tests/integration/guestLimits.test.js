import { describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { AVAILABILITY_DAYS_GUEST_PER_IP_MIN, LANDING_VISIT_PER_IP_MIN } from "../../app/lib/limits.js";

// A reel sends many phones through one carrier address (2026-11-06): the two fixed limits of 30 a minute would turn
// a neighbourhood away. Each test uses its own address, because the proxy's X-Real-IP is what the limit counts.
const fromAddress = (ip) => ({ "x-real-ip": ip, "content-type": "application/json" });

async function ask(count, send) {
  const answers = [];
  for (let start = 0; start < count; start += 25) {
    answers.push(...await Promise.all(Array.from({ length: Math.min(25, count - start) }, send)));
  }
  return answers.map((res) => res.status);
}

describe("per-address limits for guests", () => {
  it("are high enough for a shared carrier address", () => {
    expect(AVAILABILITY_DAYS_GUEST_PER_IP_MIN).toBeGreaterThanOrEqual(300);
    expect(LANDING_VISIT_PER_IP_MIN).toBeGreaterThanOrEqual(300);
  });

  it("free days: a crowd behind one address gets in, past the limit it is told to wait", async () => {
    const url = `${TEST_BASE_URL}/api/salon-bookings/availability/days?salonUserId=1&service=x&day=2030-01-05`;
    const send = () => fetch(url, { headers: fromAddress("203.0.113.71") });
    const statuses = await ask(AVAILABILITY_DAYS_GUEST_PER_IP_MIN, send);
    expect(statuses.filter((status) => status === 429)).toEqual([]);
    expect(statuses.filter((status) => status >= 500)).toEqual([]);
    expect((await send()).status).toBe(429);
  });

  it("reel link counter: same for the visit beacon", async () => {
    const send = () => fetch(`${TEST_BASE_URL}/api/landing-visit`, {
      method: "POST",
      headers: fromAddress("203.0.113.72"),
      body: JSON.stringify({ source: "limittest", kind: "open" })
    });
    const statuses = await ask(LANDING_VISIT_PER_IP_MIN, send);
    expect(statuses.filter((status) => status !== 200)).toEqual([]);
    expect((await send()).status).toBe(429);
  });
});
