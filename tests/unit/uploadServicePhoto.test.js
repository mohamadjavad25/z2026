import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PHOTO_NOT_SENT, PHOTO_TIMED_OUT, uploadServicePhoto } from "../../app/features/profile/uploadServicePhoto";

// 2026-11-07: on a phone with a VPN, a sample photo said «دارم می‌فرستم…» with no end, and when it failed nothing
// reached the admin's error list and the error line could not be read in dark mode.

const photo = { title: "کوتاهی مو", image: "data:image/jpeg;base64,AAAA" };

describe("sending a service's gallery photo", () => {
  it("stops waiting on a line that never answers, says so and reports it", async () => {
    const report = vi.fn();
    const send = (_body, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
    const result = await uploadServicePhoto(photo, { send, report, timeoutMs: 5 });
    expect(result).toEqual({ error: PHOTO_TIMED_OUT });
    expect(report.mock.calls[0][0].message).toContain("timed out");
    expect(report.mock.calls[0][1]).toBe("handled");
  });

  it("reports a dropped connection instead of hiding it", async () => {
    const report = vi.fn();
    const send = () => Promise.reject(new TypeError("Failed to fetch"));
    expect(await uploadServicePhoto(photo, { send, report })).toEqual({ error: PHOTO_NOT_SENT });
    expect(report.mock.calls[0][0].message).toContain("Failed to fetch");
  });

  it("shows the server's own words when it refuses", async () => {
    const report = vi.fn();
    const send = async () => ({ ok: false, status: 400, payload: { error: "عکس خیلی بزرگه." } });
    expect(await uploadServicePhoto(photo, { send, report })).toEqual({ error: "عکس خیلی بزرگه." });
    expect(report).toHaveBeenCalledOnce();
  });

  it("hands back the post and reports nothing when it works", async () => {
    const report = vi.fn();
    const post = { id: 7, image: "/api/image?id=7" };
    const send = async (body) => {
      expect(body.inPortfolio).toBe(false);
      return { ok: true, status: 201, payload: { data: { post } } };
    };
    expect(await uploadServicePhoto(photo, { send, report })).toEqual({ post });
    expect(report).not.toHaveBeenCalled();
  });
});

describe("text on a soft colour", () => {
  it("never pairs a fixed light background with a text colour that turns light at night", () => {
    const dir = "app/styles/features";
    const bad = readdirSync(dir)
      .filter((file) => file.endsWith(".css"))
      .flatMap((file) => readFileSync(join(dir, file), "utf8").split("\n")
        .filter((line) => /background: var\(--(pink|violet)-soft\)[^}]*[ ;]color: var\(--n-\d+\)/.test(line))
        .map((line) => `${file}: ${line.slice(0, 60)}`));
    expect(bad).toEqual([]);
  });
});
