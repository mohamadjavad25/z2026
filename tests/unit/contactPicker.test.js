import { afterEach, describe, it, expect, vi } from "vitest";
import { contactPickerNeedsAppUpdate, contactPickerSupported, localPhoneOf, pickContact } from "../../app/shared/lib/contactPicker.js";

afterEach(() => { vi.unstubAllGlobals(); });

function stubAppBridge(nativePromise) {
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("window", {
    Capacitor: {
      isNativePlatform: () => true,
      nativePromise,
      PluginHeaders: [{ name: "App" }, { name: "ContactPicker" }]
    }
  });
}

describe("contact picker", () => {
  it("is off without the app plugin or the browser API", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { Capacitor: { isNativePlatform: () => true, nativePromise: () => null, PluginHeaders: [{ name: "App" }] } });
    expect(contactPickerSupported()).toBe(false);
  });

  it("ignores the WebView's dead navigator.contacts inside an older app", () => {
    vi.stubGlobal("navigator", { contacts: { select: async () => [] } });
    vi.stubGlobal("window", { ContactsManager: function ContactsManager() {}, Capacitor: { isNativePlatform: () => true, nativePromise: () => null, PluginHeaders: [{ name: "App" }] } });
    expect(contactPickerSupported()).toBe(false);
    expect(contactPickerNeedsAppUpdate()).toBe(true);
  });

  it("uses the Android app's own picker", async () => {
    const nativePromise = vi.fn(async () => ({ name: " سارا ", phones: ["0912 345 6789", "0912 345 6789"] }));
    stubAppBridge(nativePromise);
    expect(contactPickerSupported()).toBe(true);
    await expect(pickContact()).resolves.toEqual({ name: "سارا", phones: ["0912 345 6789"] });
    expect(nativePromise).toHaveBeenCalledWith("ContactPicker", "pick", {});
  });

  it("returns null when the person backs out of the app's picker", async () => {
    stubAppBridge(async () => ({ cancelled: true }));
    await expect(pickContact()).resolves.toBeNull();
  });

  it("gives the booking form an 09… mobile number", () => {
    expect(localPhoneOf(["+98 912 345 6789"])).toBe("09123456789");
    expect(localPhoneOf(["۰۹۱۲-۳۴۵-۶۷۸۹"])).toBe("09123456789");
    expect(localPhoneOf(["021 8888 1234", "00989123456789"])).toBe("09123456789");
    expect(localPhoneOf(["021 8888 1234"])).toBe("02188881234");
    expect(localPhoneOf([])).toBe("");
  });
});
