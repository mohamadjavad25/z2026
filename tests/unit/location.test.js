import { describe, it, expect } from "vitest";
import { publicLocation } from "../../app/lib/location.js";
import { detectPlatform, fullAddress, navigationLinks, SNAPP_URL, TAPSI_WEB_URL, tapsiLink, tapsiRideLink, tapsiWebLink } from "../../app/shared/lib/mapLinks.js";

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

describe("navigationLinks", () => {
  it("sends the pin to Google Maps, Balad and Neshan, in that order", () => {
    const links = navigationLinks(pinned);
    expect(links.map((link) => link.id)).toEqual(["google", "balad", "neshan"]);
    expect(links[0].href).toBe("https://www.google.com/maps/dir/?api=1&destination=35.730123,51.411235");
    expect(links[1].href).toBe("https://balad.ir/location?latitude=35.730123&longitude=51.411235&zoom=17");
    expect(links[2].href).toBe("https://nshn.ir/?lat=35.730123&lng=51.411235");
  });

  it("adds the phone's own chooser on Android and Apple Maps on iPhone", () => {
    expect(navigationLinks(pinned, "android").at(-1)).toEqual({ id: "other", label: "برنامه‌های دیگر", href: "geo:35.730123,51.411235?q=35.730123,51.411235" });
    expect(navigationLinks(pinned, "ios").at(-1).href).toBe("https://maps.apple.com/?daddr=35.730123,51.411235");
  });

  it("without a pin only searches the address in Google Maps", () => {
    const links = navigationLinks({ address: "تهران، ونک", detail: "", lat: null, lng: null }, "android");
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("تهران، ونک")}`);
  });

  it("has nothing for no location", () => {
    expect(navigationLinks(null)).toEqual([]);
  });
});

describe("fullAddress / detectPlatform", () => {
  it("joins the address and the plate / floor", () => {
    expect(fullAddress(pinned)).toBe("تهران، یوسف‌آباد، خیابان اسدآبادی، پلاک ۸، طبقه ۲");
    expect(fullAddress({ address: "تهران", detail: "" })).toBe("تهران");
  });

  it("reads the platform from the user agent", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) frfro-app")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0)")).toBe("");
  });

  it("opens Snapp's own web app", () => {
    expect(SNAPP_URL).toBe("https://app.snapp.taxi/");
  });
});

describe("tapsiLink", () => {
  it("opens Tapsi on the ride to the pin, from the client when known", () => {
    expect(tapsiLink({ lat: 31.34, lng: 48.69 })).toBe("tap30://ride/?daddr=31.34,48.69");
    expect(tapsiLink({ lat: 31.34, lng: 48.69 }, { lat: 31.3183, lng: 48.6706 })).toBe("tap30://ride/?saddr=31.3183,48.6706&daddr=31.34,48.69");
  });

  it("needs the salon's pin", () => {
    expect(tapsiLink({ address: "اهواز" })).toBe("");
    expect(tapsiLink(null)).toBe("");
  });

  it("rounds the points like the map links", () => {
    expect(tapsiLink(pinned)).toBe("tap30://ride/?daddr=35.730123,51.411235");
  });
});

describe("tapsiRideLink", () => {
  it("is the ride link on Android only", () => {
    expect(tapsiRideLink(pinned, "android")).toBe("tap30://ride/?daddr=35.730123,51.411235");
    expect(tapsiRideLink(pinned, "android", { lat: 35.7, lng: 51.4 })).toBe("tap30://ride/?saddr=35.7,51.4&daddr=35.730123,51.411235");
  });

  it("is empty on iPhone, desktop and without a pin, where the address is copied instead", () => {
    expect(tapsiRideLink(pinned, "ios")).toBe("");
    expect(tapsiRideLink(pinned, "")).toBe("");
    expect(tapsiRideLink({ address: "تهران", lat: null, lng: null }, "android")).toBe("");
    expect(TAPSI_WEB_URL).toBe("https://app.tapsi.cab/");
  });
});

describe("tapsiWebLink", () => {
  it("opens the web app's car choice when the client's position is known, in its [lng,lat] spelling", () => {
    // The shape the user confirmed on their phone on 2026-10-20.
    expect(tapsiWebLink(pinned, { lat: 35.712, lng: 51.411 }))
      .toBe("https://app.tapsi.cab/preview?origin=%5B51.411,35.712%5D&destinations=%5B%5B51.411235,35.730123%5D%5D");
  });

  it("otherwise fills the destination and lets Tapsi ask where the client is", () => {
    expect(tapsiWebLink(pinned)).toBe("https://app.tapsi.cab/map/origin?destinations=%5B%5B51.411235,35.730123%5D%5D");
  });

  it("decodes to what the web app parses", () => {
    const url = new URL(tapsiWebLink(pinned, { lat: 35.712, lng: 51.411 }));
    expect(JSON.parse(url.searchParams.get("origin"))).toEqual([51.411, 35.712]);
    expect(JSON.parse(url.searchParams.get("destinations"))).toEqual([[51.411235, 35.730123]]);
  });

  it("needs the salon's pin", () => {
    expect(tapsiWebLink({ address: "تهران", lat: null, lng: null })).toBe("");
  });
});

describe("«تکمیل پروفایل» asks for the pin", () => {
  it("is a step until the owner has a pin, after the area", async () => {
    const { getProfileSteps } = await import("../../app/features/profile/ProfileCompleteness.jsx");
    const salon = (location) => ({ type: "salon", data: { area: "تهران", location } });
    const pinStep = (profile) => getProfileSteps(profile, 0).find((step) => step.id === "pin");
    expect(getProfileSteps(salon(null), 0).map((step) => step.id)).toEqual(["avatar", "area", "pin", "specialty", "services"]);
    expect(pinStep(salon(null)).done).toBe(false);
    expect(pinStep(salon({ address: "تهران", lat: null, lng: null })).done).toBe(false);
    expect(pinStep(salon({ address: "تهران", lat: 35.7, lng: 51.4 })).done).toBe(true);
  });
});
