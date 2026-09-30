import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildStorageKey, isStorageConfigured, uploadImageDataUrl } from "../../app/lib/storage.js";

/**
 * Unit tests for the parts of app/lib/storage.js that don't need a real
 * Supabase project -- key/path generation, and the graceful-degradation
 * behavior every dual-write call site depends on (never throw, return
 * null when unconfigured). The actual upload call against a live bucket
 * is NOT covered here: this sandbox has neither Supabase credentials nor
 * network access to supabase.com to verify that leg (see docs/DEVLOG.md).
 */

const ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("buildStorageKey", () => {
  it("builds a path of the form kind/ownerId/unique.ext", () => {
    const key = buildStorageKey("avatar", 42, "image/jpeg");
    expect(key).toMatch(/^avatar\/42\/[a-z0-9]+-[a-z0-9]+\.jpg$/);
  });

  it("maps known content types to the right extension", () => {
    expect(buildStorageKey("post", 1, "image/png")).toMatch(/\.png$/);
    expect(buildStorageKey("post", 1, "image/webp")).toMatch(/\.webp$/);
    expect(buildStorageKey("post", 1, "image/gif")).toMatch(/\.gif$/);
  });

  it("falls back to .bin for an unrecognized content type", () => {
    expect(buildStorageKey("post", 1, "application/octet-stream")).toMatch(/\.bin$/);
  });

  it("sanitizes kind and ownerId so a key never escapes its own path segment", () => {
    const key = buildStorageKey("../../etc", "1/../2", "image/png");
    expect(key.startsWith("etc/12/") || key.startsWith("etc/1/")).toBe(true);
    expect(key).not.toContain("..");
  });

  it("produces distinct keys for back-to-back calls (no collisions on rapid uploads)", () => {
    const keys = new Set(Array.from({ length: 20 }, () => buildStorageKey("avatar", 1, "image/jpeg")));
    expect(keys.size).toBe(20);
  });
});

describe("isStorageConfigured / uploadImageDataUrl without credentials", () => {
  it("reports not configured when SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are unset", () => {
    expect(isStorageConfigured()).toBe(false);
  });

  it("uploadImageDataUrl never throws and returns null when unconfigured", async () => {
    const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    await expect(uploadImageDataUrl(tinyPngDataUrl, { kind: "avatar", ownerId: 1 })).resolves.toBeNull();
  });

  it("returns null for a malformed data URL without ever reaching the network", async () => {
    await expect(uploadImageDataUrl("not-a-data-url", { kind: "avatar", ownerId: 1 })).resolves.toBeNull();
  });

  it("returns null for a disallowed content type", async () => {
    const svgDataUrl = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
    await expect(uploadImageDataUrl(svgDataUrl, { kind: "avatar", ownerId: 1 })).resolves.toBeNull();
  });
});
