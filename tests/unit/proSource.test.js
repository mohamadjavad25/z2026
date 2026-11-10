import { describe, expect, it } from "vitest";
import { proSourceTag } from "../../app/features/landing/proSource.js";

describe("the SMS page's counter tag", () => {
  it("tags each message's link on its own", () => {
    expect(proSourceTag("/s/a")).toBe("sms-a");
    expect(proSourceTag("/s/B/")).toBe("sms-b");
  });
  it("falls back to the plain tag", () => {
    expect(proSourceTag("/s")).toBe("sms");
    expect(proSourceTag("/s/")).toBe("sms");
    expect(proSourceTag("")).toBe("sms");
  });
  it("keeps only safe characters and fits the counter's 24", () => {
    expect(proSourceTag("/s/a<script>")).toBe("sms-ascript");
    expect(proSourceTag("/s/" + "x".repeat(60)).length).toBeLessThanOrEqual(24);
  });
});
