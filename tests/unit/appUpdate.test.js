import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { APP_PACKAGE, appHasPlugin, appTooOldFor, inAndroidApp, updateState } from "../../app/shared/lib/appUpdate.js";

function fakeApp(plugins, platform = "android") {
  globalThis.window = {
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => platform,
      nativePromise: async () => ({}),
      PluginHeaders: plugins.map(([name, methods = []]) => ({ name, methods: methods.map((method) => ({ name: method })) }))
    }
  };
}

afterEach(() => {
  delete globalThis.window;
});

describe("app build checks", () => {
  it("outside the app nothing is too old", () => {
    expect(inAndroidApp()).toBe(false);
    expect(appTooOldFor("StoryShare")).toBe(false);
  });

  it("the Cafe Bazaar build (no StoryShare) is too old for the story buttons", () => {
    fakeApp([["App", ["getInfo"]], ["ContactPicker", ["pick"]], ["FrfroPush", ["status"]]]);
    expect(appTooOldFor("StoryShare")).toBe(true);
    expect(appTooOldFor("ContactPicker")).toBe(false);
  });

  it("checks a plugin's method, not only its name", () => {
    fakeApp([["StoryShare", ["share", "save"]]]);
    expect(appHasPlugin("StoryShare")).toBe(true);
    expect(appHasPlugin("StoryShare", "shareText")).toBe(false);
    expect(appTooOldFor("StoryShare", "shareText")).toBe(true);
  });

  it("iPhone's shell is not the Android app", () => {
    fakeApp([], "ios");
    expect(inAndroidApp()).toBe(false);
  });
});

describe("updateState", () => {
  const app = (build) => ({ id: APP_PACKAGE, build });

  it("asks only when Bazaar has a newer build", () => {
    expect(updateState(app(2), { latestBuild: 3 })).toEqual({ available: true, forced: false });
    expect(updateState(app(3), { latestBuild: 3 })).toEqual({ available: false, forced: false });
    expect(updateState(app(4), { latestBuild: 3 })).toEqual({ available: false, forced: false });
  });

  it("forces only an older build, and only when the panel says so", () => {
    expect(updateState(app(2), { latestBuild: 3, forceUpdate: true })).toEqual({ available: true, forced: true });
    expect(updateState(app(3), { latestBuild: 3, forceUpdate: true })).toEqual({ available: false, forced: false });
  });

  it("never asks the private admin app, or when the build or setting is unknown", () => {
    expect(updateState({ id: "ir.frfro.admin", build: 1 }, { latestBuild: 3, forceUpdate: true }).available).toBe(false);
    expect(updateState(app(null), { latestBuild: 3 }).available).toBe(false);
    expect(updateState(null, { latestBuild: 3 }).available).toBe(false);
    expect(updateState(app(2), null).available).toBe(false);
  });
});

// The Android app's WebView cannot download: a link with `download` does nothing there while the page may say "saved"
// (the ready story did, 2026-10-30, although it checked for the new app: the old-app case was missing). Every screen
// that downloads must also handle an app too old for saving (appTooOldFor: save through the app or ask
// for the update). Pages never shown inside the app are listed here.
const NOT_IN_APP = new Set([
  "app/admin/ui.jsx",                        // the admin panel's exports, on a computer
  "app/features/landing/AppLanding.jsx"      // the about page with the APK link, tablets and desktops
]);

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

describe("downloads inside the app", () => {
  it("every screen that downloads also handles the app", () => {
    const root = path.resolve(__dirname, "../..");
    const offenders = sources(path.join(root, "app"))
      .map((file) => path.relative(root, file).split(path.sep).join("/"))
      .filter((file) => !file.startsWith("app/api/") && !NOT_IN_APP.has(file))
      .filter((file) => {
        const text = readFileSync(path.join(root, file), "utf8");
        const downloads = /\.download\s*=|\sdownload=["{]/.test(text);
        return downloads && !/appTooOldFor/.test(text);
      });
    expect(offenders).toEqual([]);
  });
});
