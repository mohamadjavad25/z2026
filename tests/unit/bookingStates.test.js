import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ANY_LIVE, confirmedStatuses, isConfirmedBooking } from "../../app/shared/lib/bookingStates.js";

const HOME = "app/shared/lib/bookingStates.js";

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.jsx?$/.test(name) ? [path.split("\\").join("/")] : [];
  });
}

describe("what a booking status means", () => {
  it("«تازه» is settled at a salon and waiting at an artist", () => {
    expect(isConfirmedBooking("salon", "تازه")).toBe(true);
    expect(isConfirmedBooking("artist", "تازه")).toBe(false);
    expect(isConfirmedBooking("artist", "تایید")).toBe(true);
    expect(isConfirmedBooking("salon", "درخواست")).toBe(false);
    expect(confirmedStatuses("artist")).toContain("تایید شده");
  });

  it("an artist's own entry can be cancelled by the admin panel", () => {
    expect(ANY_LIVE).toContain("تایید");
  });

  it("no second copy of a status list on the server", () => {
    const copies = /\[\s*"تایید شده",\s*"(تازه|تایید)"\s*\]|\[\s*"(تازه|تایید)",\s*"تایید شده"\s*\]|\[\s*"تازه",\s*"درخواست",\s*"تایید|IN \('تایید شده', '(تازه|تایید)'\)|IN \('(تازه|تایید)', 'تایید شده'\)|IN \('تازه', 'درخواست', 'تایید/;
    const found = [...sources("app/lib"), ...sources("app/api")].filter((file) => file !== HOME && copies.test(readFileSync(file, "utf8")));
    expect(found).toEqual([]);
  });
});
