import { describe, it, expect } from "vitest";
import { publicLocation } from "../../app/lib/location.js";

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
