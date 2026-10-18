import { describe, it, expect } from "vitest";
import { parseAttachments, sniffAudio, sniffImage } from "../../app/lib/supportMedia.js";
import { createMp3Encoder } from "../../app/features/support/mp3Encoder.js";

const dataUrl = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
const pad = (head, size = 400) => Buffer.concat([Buffer.from(head), Buffer.alloc(size)]);

describe("support attachments", () => {
  it("tells real pictures and recordings by their first bytes", () => {
    expect(sniffImage(pad([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(sniffImage(Buffer.concat([Buffer.from("RIFF0000WEBP"), Buffer.alloc(8)]))).toBe("image/webp");
    expect(sniffImage(Buffer.from("<svg></svg>"))).toBe("");
    expect(sniffAudio(pad([0x1a, 0x45, 0xdf, 0xa3]))).toBe("audio/webm");
    expect(sniffAudio(pad("OggS"))).toBe("audio/ogg");
    expect(sniffAudio(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypmp42")]))).toBe("audio/mp4");
    expect(sniffAudio(Buffer.from("hello"))).toBe("");
  });

  it("accepts up to four pictures or one voice note, and says why otherwise", () => {
    const jpeg = { kind: "image", data: dataUrl("image/jpeg", pad([0xff, 0xd8, 0xff])) };
    const voice = { kind: "voice", data: dataUrl("audio/webm;codecs=opus", pad([0x1a, 0x45, 0xdf, 0xa3])), durationMs: 3000 };
    expect(parseAttachments(undefined)).toEqual({ ok: true, items: [] });
    expect(parseAttachments([jpeg, jpeg]).items.map((item) => item.contentType)).toEqual(["image/jpeg", "image/jpeg"]);
    expect(parseAttachments([voice]).items[0]).toMatchObject({ kind: "voice", contentType: "audio/webm", durationMs: 3000 });
    expect(parseAttachments([jpeg, jpeg, jpeg, jpeg, jpeg]).ok).toBe(false);
    expect(parseAttachments([jpeg, voice]).ok).toBe(false);
    expect(parseAttachments([{ ...voice, durationMs: 10 * 60 * 1000 }]).ok).toBe(false);
    expect(parseAttachments([{ kind: "image", data: dataUrl("image/png", Buffer.from("not a png at all")) }]).ok).toBe(false);
    expect(parseAttachments([{ kind: "file", data: jpeg.data }]).ok).toBe(false);
    expect(parseAttachments([{ kind: "image", data: dataUrl("image/jpeg", pad([0xff, 0xd8, 0xff], 3.5 * 1024 * 1024)) }]).ok).toBe(false);
  });
});

describe("voice notes are MP3 (playable on every phone, old iPhones included)", () => {
  it("turns microphone sound at the device's rate into an MP3 the server accepts", () => {
    for (const rate of [48000, 44100]) {
      const encoder = createMp3Encoder(rate);
      // Two seconds of a tone, fed in the 4096-sample blocks the recorder gets.
      for (let start = 0; start < rate * 2; start += 4096) {
        encoder.push(Float32Array.from({ length: Math.min(4096, rate * 2 - start) }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 440 * (start + i)) / rate)));
      }
      expect(Math.abs(encoder.durationMs() - 2000)).toBeLessThan(20);
      const bytes = Buffer.concat(encoder.finish().map((chunk) => Buffer.from(chunk)));
      expect(sniffAudio(bytes)).toBe("audio/mpeg");
      expect(bytes.length).toBeGreaterThan(6000); // ~32kbps
      expect(bytes.length).toBeLessThan(12000);
      const parsed = parseAttachments([{ kind: "voice", data: `data:audio/mpeg;base64,${bytes.toString("base64")}`, durationMs: 2000 }]);
      expect(parsed.items[0]).toMatchObject({ contentType: "audio/mpeg", durationMs: 2000 });
    }
  });
});
