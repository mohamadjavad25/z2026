import { afterEach, describe, expect, it, vi } from "vitest";
import { compressImageToDataUrl, retryPhotoRead } from "../../app/shared/lib/imageCompression.js";
import { isPickedImage } from "../../app/shared/lib/imageCompression.js";
import { prepareImage } from "../../app/features/support/media.js";

// Client error of 2026-11-04 (Android app): «The requested file could not be read…» escaped as an unhandled rejection
// when a gallery photo could not be read. Picking such a photo now says so in Persian and nothing is thrown.
function readerThat(outcome) {
  return class {
    readAsDataURL() {
      queueMicrotask(() => {
        if (outcome === "fail") {
          this.error = Object.assign(new Error("The requested file could not be read"), { name: "NotReadableError" });
          this.onerror?.();
        } else {
          this.result = "data:image/png;base64,AAAA";
          this.onload?.();
        }
      });
    }
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("a photo the phone cannot hand over", () => {
  it("the logo, poster and team photo reader resolves to nothing instead of throwing", async () => {
    vi.stubGlobal("FileReader", readerThat("fail"));
    await expect(compressImageToDataUrl({ type: "image/jpeg", size: 10 })).resolves.toBe("");
  });

  it("leaves us a quiet note of what the phone said, without any crash", async () => {
    const sent = [];
    vi.stubGlobal("navigator", { sendBeacon: (_url, blob) => { sent.push(blob); return true; }, userAgent: "test" });
    vi.stubGlobal("FileReader", readerThat("fail"));
    await compressImageToDataUrl({ type: "image/heic", size: 2048 });
    expect(sent).toHaveLength(1);
    const report = JSON.parse(await sent[0].text());
    expect(report.source).toBe("handled");
    expect(report.message).toContain("NotReadableError");
    expect(report.message).toContain("image/heic");
  });

  it("takes a gallery photo that arrives with no type, and still refuses other files", () => {
    expect(isPickedImage({ type: "" })).toBe(true);
    expect(isPickedImage({ type: "image/jpeg" })).toBe(true);
    expect(isPickedImage({ type: "application/pdf" })).toBe(false);
    expect(isPickedImage(null)).toBe(false);
  });

  it("a readable photo still comes back", async () => {
    vi.stubGlobal("FileReader", readerThat("ok"));
    await expect(compressImageToDataUrl({ type: "image/png", size: 10 })).resolves.toBe("data:image/png;base64,AAAA");
  });

  // 2026-11-06: the owner's phone refused three photos, then handed the same three over minutes later.
  it("a photo the phone refuses once arrives on the next try, and we hear that it did", async () => {
    const sent = [];
    vi.stubGlobal("navigator", { sendBeacon: (_url, blob) => { sent.push(blob); return true; }, userAgent: "test" });
    let reads = 0;
    vi.stubGlobal("FileReader", class {
      readAsDataURL(file) {
        reads += 1;
        new (readerThat(reads === 1 ? "fail" : "ok"))().readAsDataURL.call(this, file);
      }
    });
    await expect(compressImageToDataUrl({ type: "image/jpeg", size: 3072, lastModified: Date.now() - 120000 }))
      .resolves.toBe("data:image/png;base64,AAAA");
    expect(reads).toBe(2);
    expect(sent).toHaveLength(1);
    const report = JSON.parse(await sent[0].text());
    expect(report.source).toBe("handled");
    expect(report.message).toContain("photo read on retry: NotReadableError");
    expect(report.message).toContain("tries 2");
    expect(report.message).toContain("photo age 2 min");
  });

  it("gives up after three tries with what the phone said", async () => {
    const sent = [];
    vi.stubGlobal("navigator", { sendBeacon: (_url, blob) => { sent.push(blob); return true; }, userAgent: "test" });
    const attempt = vi.fn().mockRejectedValue(Object.assign(new Error("no"), { name: "NotReadableError" }));
    await expect(retryPhotoRead({ type: "image/jpeg", size: 4096 }, attempt)).rejects.toThrow("no");
    expect(attempt).toHaveBeenCalledTimes(3);
    const report = JSON.parse(await sent[0].text());
    expect(report.message).toContain("photo unreadable: NotReadableError");
    expect(report.message).toContain("tries 3");
  });

  it("a photo read the first time sends us nothing", async () => {
    const sent = [];
    vi.stubGlobal("navigator", { sendBeacon: (_url, blob) => { sent.push(blob); return true; }, userAgent: "test" });
    await expect(retryPhotoRead({ type: "image/jpeg", size: 1 }, async () => "ok")).resolves.toBe("ok");
    expect(sent).toHaveLength(0);
  });

  it("the support chat keeps what the phone said in our note", async () => {
    const sent = [];
    vi.stubGlobal("navigator", { sendBeacon: (_url, blob) => { sent.push(blob); return true; }, userAgent: "test" });
    vi.stubGlobal("FileReader", readerThat("fail"));
    await expect(prepareImage({ type: "image/gif", size: 5120 })).rejects.toThrow("یه عکس دیگه بفرست");
    expect(JSON.parse(await sent[0].text()).message).toContain("photo unreadable: NotReadableError");
  });

  it("the support chat shows Persian words, not the browser's", async () => {
    vi.stubGlobal("FileReader", readerThat("fail"));
    await expect(prepareImage({ type: "image/gif", size: 10 })).rejects.toThrow("این عکس باز نشد؛ یه عکس دیگه بفرست.");
  });
});
