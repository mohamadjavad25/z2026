import { afterEach, describe, expect, it, vi } from "vitest";
import { reportClientError } from "../../app/shared/lib/reportClientError.js";

// 2026-11-01: Instagram's in-app browser threw from its own injected script and it landed in our error list.
describe("reportClientError", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubBeacon() {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon, userAgent: "test" });
    return sendBeacon;
  }

  it("ignores errors from scripts an in-app browser injects", () => {
    const sendBeacon = stubBeacon();
    reportClientError({ message: "Error invoking postMessage: Java object is gone", stack: "at sendDataToNative (iabjs://navigation_performance_logger_android:1:1)" });
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("still reports our own errors", () => {
    const sendBeacon = stubBeacon();
    reportClientError(new TypeError("x is undefined"));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("sends one message once and stops after ten, so a bad release cannot flood the server", () => {
    const sendBeacon = stubBeacon();
    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < 30; i += 1) reportClientError(new Error(`flood ${i}`));
    }
    expect(sendBeacon.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
