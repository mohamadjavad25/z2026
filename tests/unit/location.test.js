import { describe, it, expect } from "vitest";
import { publicLocation } from "../../app/lib/location.js";
import { baladLink, fullAddress } from "../../app/shared/lib/mapLinks.js";

const pinned = { address: "تهران، یوسف‌آباد، خیابان اسدآبادی", detail: "پلاک ۸، طبقه ۲", lat: 35.7301234567, lng: 51.4112345678 };

describe("publicLocation", () => {
  it("is null when there is neither an address nor a pin", () => {
    expect(publicLocation(null)).toBeNull();
    expect(publicLocation({ area: "  ", geo_lat: null, geo_lng: null })).toBeNull();
  });

  it("keeps the address without a pin", () => {
    expect(publicLocation({ area: "تهران", address_detail: "", geo_lat: null, geo_lng: null }))
      .toEqual({ address: "تهران", detail: "", lat: null, lng: null });
  });

  it("turns the database's numbers (or numeric strings) into a pin", () => {
    expect(publicLocation({ area: "تهران", address_detail: " طبقه ۲ ", geo_lat: "35.7", geo_lng: 51.4 }))
      .toEqual({ address: "تهران", detail: "طبقه ۲", lat: 35.7, lng: 51.4 });
  });

  it("drops half a pin", () => {
    expect(publicLocation({ area: "تهران", geo_lat: 35.7, geo_lng: null })).toEqual({ address: "تهران", detail: "", lat: null, lng: null });
  });
});

describe("baladLink", () => {
  it("opens Balad on the pin, to see the place", () => {
    expect(baladLink(pinned)).toBe("https://balad.ir/location?latitude=35.730123&longitude=51.411235&zoom=17");
  });

  it("has no link without a pin or without a location", () => {
    expect(baladLink({ address: "تهران، ونک", detail: "", lat: null, lng: null })).toBe("");
    expect(baladLink(null)).toBe("");
  });
});

describe("fullAddress", () => {
  it("joins the address and the plate / floor", () => {
    expect(fullAddress(pinned)).toBe("تهران، یوسف‌آباد، خیابان اسدآبادی، پلاک ۸، طبقه ۲");
    expect(fullAddress({ address: "تهران", detail: "" })).toBe("تهران");
  });
});
