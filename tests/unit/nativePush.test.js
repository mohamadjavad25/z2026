import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); });

/** A fake app bridge. `answers` maps "Plugin.method" to what the native side returns. */
function stubApp({ plugins = ["App", "PushNotifications", "FrfroPush"], answers = {}, stored = "" } = {}) {
  const listeners = {};
  const storage = new Map(stored ? [["frfro-app-push-token", stored]] : []);
  const nativePromise = vi.fn(async (plugin, method) => answers[`${plugin}.${method}`] ?? {});
  const fetch = vi.fn(async () => new Response("{}"));
  const assign = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("window", {
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      nativePromise,
      nativeCallback: (plugin, method, { eventName }, callback) => { listeners[eventName] = callback; },
      PluginHeaders: plugins.map((name) => ({ name }))
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    },
    location: { pathname: "/", search: "", assign }
  });
  return { listeners, storage, nativePromise, fetch, assign };
}

async function load() {
  vi.resetModules();
  return import("../../app/shared/lib/nativePush.js");
}

describe("app push", () => {
  it("is not there in a browser or in the old app", async () => {
    const push = await load();
    vi.stubGlobal("window", {});
    expect(push.appPushAvailable()).toBe(false);
    stubApp({ plugins: ["App", "ContactPicker"] });
    expect(push.appPushAvailable()).toBe(false);
    expect(await push.startAppPush()).toBe(false);
  });

  it("never registers in a build without Firebase (it would crash the app)", async () => {
    const app = stubApp({ answers: { "FrfroPush.status": { ready: false } } });
    const push = await load();
    expect(await push.startAppPush()).toBe(false);
    expect(app.nativePromise).not.toHaveBeenCalledWith("PushNotifications", "register", {});
  });

  it("asks once, registers, and saves the token on the server", async () => {
    const app = stubApp({
      answers: {
        "FrfroPush.status": { ready: true },
        "PushNotifications.checkPermissions": { receive: "prompt" },
        "PushNotifications.requestPermissions": { receive: "granted" }
      }
    });
    const push = await load();
    expect(await push.startAppPush()).toBe(true);
    expect(app.nativePromise).toHaveBeenCalledWith("PushNotifications", "register", {});
    app.listeners.registration({ value: "tok-1" });
    expect(app.storage.get("frfro-app-push-token")).toBe("tok-1");
    const [url, init] = app.fetch.mock.calls[0];
    expect(url).toBe("/api/push/native");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: "tok-1", platform: "android" });
  });

  it("drops the saved token when notifications were turned off", async () => {
    const app = stubApp({
      stored: "tok-old",
      answers: { "FrfroPush.status": { ready: true }, "PushNotifications.checkPermissions": { receive: "denied" } }
    });
    const push = await load();
    expect(await push.startAppPush()).toBe(false);
    const [, init] = app.fetch.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body).token).toBe("tok-old");
    expect(app.storage.has("frfro-app-push-token")).toBe(false);
  });

  it("opens the notification's page, only on this site", async () => {
    const app = stubApp({ answers: { "FrfroPush.status": { ready: true }, "PushNotifications.checkPermissions": { receive: "granted" } } });
    const push = await load();
    await push.startAppPush();
    app.listeners.pushNotificationActionPerformed({ notification: { data: { url: "/?billing=plans" } } });
    app.listeners.pushNotificationActionPerformed({ notification: { data: { url: "https://evil.example/" } } });
    app.listeners.pushNotificationActionPerformed({ notification: { data: { url: "//evil.example/" } } });
    expect(app.assign.mock.calls).toEqual([["/?billing=plans"]]);
  });

  it("stops this phone's notifications on logout", async () => {
    const app = stubApp({ stored: "tok-1" });
    const push = await load();
    await push.stopAppPush();
    expect(app.fetch.mock.calls[0][1].method).toBe("DELETE");
    expect(app.storage.has("frfro-app-push-token")).toBe(false);
  });
});
