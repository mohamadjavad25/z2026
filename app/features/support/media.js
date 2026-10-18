"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Pictures and voice notes for the support chat, on the browser side. The server checks everything again (app/lib/supportMedia.js). */

export const MAX_IMAGES = 4;
export const MAX_VOICE_SECONDS = 180;
const MAX_SIDE = 1600;

export const attachmentUrl = (id) => `/api/support/attachments/${id}`;

/** "۱:۰۷" from milliseconds. */
export function duration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * A phone photo is often 4-8MB: shrink it to at most 1600px on its long side as a JPEG, which keeps a screenshot readable
 * at a few hundred KB. A GIF is sent as is (it may move). Rejects anything that is not a picture.
 */
export async function prepareImage(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("فقط عکس می‌شود فرستاد.");
  if (file.type === "image/gif") {
    if (file.size > 3 * 1024 * 1024) throw new Error("این GIF خیلی بزرگ است.");
    return readAsDataUrl(file);
  }
  // Decoded straight from the file (blob: URLs are not allowed for pictures by the site's CSP); a data URL is the fallback.
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("این عکس باز نشد."));
      readAsDataUrl(file).then((url) => (img.src = url), reject);
    });
  }
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

const AudioCtx = () => (typeof window === "undefined" ? null : window.AudioContext || window.webkitAudioContext || null);

export const canRecordVoice = () =>
  typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(AudioCtx());

// The MP3 encoder (~100KB) is loaded only where someone may record, ahead of the tap so recording starts at once.
let encoderModule;
export const loadVoiceEncoder = () => (encoderModule ??= import("./mp3Encoder").catch((error) => {
  encoderModule = undefined;
  throw error;
}));

/**
 * Voice recording: start() asks for the microphone and records; stop() resolves with { data, durationMs, blob } (data is a
 * data URL of an MP3), cancel() throws the recording away. `level` (0..1) is the live loudness, for the little bars.
 * Stops on its own at three minutes and hands the recording to `onLimit`.
 *
 * Not MediaRecorder: it makes WebM on Chrome/Android, which older iPhones cannot play. The raw sound is taken from the
 * Web Audio graph instead and encoded to MP3 as it comes in (mp3Encoder.js), so every phone can play every voice note.
 * ScriptProcessor is old but it is what every iPhone and Android WebView still has.
 */
export function useVoiceRecorder({ onLimit } = {}) {
  const [state, setState] = useState("idle"); // idle | starting | recording
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const live = useRef(null);
  const onLimitRef = useRef(onLimit);
  onLimitRef.current = onLimit;

  const cleanup = useCallback(() => {
    const current = live.current;
    live.current = null;
    if (!current) return;
    clearInterval(current.timer);
    if (current.processor) current.processor.onaudioprocess = null;
    try {
      current.source?.disconnect();
      current.processor?.disconnect();
    } catch {
      // already disconnected
    }
    current.stream?.getTracks().forEach((track) => track.stop());
    current.audio.close?.().catch(() => {});
    setState("idle");
    setElapsed(0);
    setLevel(0);
  }, []);

  const finish = useCallback(async () => {
    const current = live.current;
    if (!current || current.stopping || !current.encoder) return null;
    current.stopping = true;
    if (current.processor) current.processor.onaudioprocess = null;
    const durationMs = current.encoder.durationMs();
    const blob = new Blob(current.encoder.finish(), { type: "audio/mpeg" });
    cleanup();
    if (durationMs < 700 || blob.size < 200) {
      setError("صدا خیلی کوتاه بود. دکمهٔ میکروفون را بزن و حرف بزن.");
      return null;
    }
    return { data: await readAsDataUrl(blob), durationMs, blob };
  }, [cleanup]);

  const start = useCallback(async () => {
    if (live.current) return;
    setError("");
    const Ctx = AudioCtx();
    if (!Ctx) return setError("این مرورگر ضبط صدا را پشتیبانی نمی‌کند.");
    // Made inside the tap itself: iPhones only let sound start from a tap, not after the permission prompt.
    const audio = new Ctx();
    audio.resume?.().catch(() => {});
    const current = { audio, stream: null, source: null, processor: null, encoder: null, timer: 0, startedAt: 0, stopping: false };
    live.current = current;
    setState("starting");
    let encoderLib;
    try {
      [current.stream, encoderLib] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
        loadVoiceEncoder()
      ]);
    } catch (failure) {
      cleanup();
      const denied = failure?.name === "NotAllowedError" || failure?.name === "SecurityError";
      const missing = failure?.name === "NotFoundError" || failure?.name === "OverconstrainedError";
      setError(denied ? "اجازهٔ میکروفون داده نشد. از تنظیمات مرورگر یا گوشی اجازه بده." : missing ? "میکروفون پیدا نشد." : "ضبط صدا شروع نشد. صفحه را دوباره باز کن و امتحان کن.");
      return;
    }
    if (live.current !== current) {
      // Cancelled while the permission prompt was open.
      current.stream.getTracks().forEach((track) => track.stop());
      return;
    }
    await audio.resume?.().catch(() => {});
    current.encoder = encoderLib.createMp3Encoder(audio.sampleRate);
    current.source = audio.createMediaStreamSource(current.stream);
    current.processor = audio.createScriptProcessor(4096, 1, 1);
    // The processor only runs while connected to the speakers; a silent gain keeps the voice from playing back.
    const mute = audio.createGain();
    mute.gain.value = 0;
    current.source.connect(current.processor);
    current.processor.connect(mute);
    mute.connect(audio.destination);
    current.processor.onaudioprocess = (event) => {
      const block = event.inputBuffer.getChannelData(0);
      current.encoder.push(block);
      let peak = 0;
      for (let i = 0; i < block.length; i += 16) peak = Math.max(peak, Math.abs(block[i]));
      setLevel(Math.min(1, peak * 2));
    };
    current.startedAt = Date.now();
    setState("recording");
    current.timer = setInterval(() => {
      setElapsed(Date.now() - current.startedAt);
      if (current.encoder.durationMs() >= MAX_VOICE_SECONDS * 1000 && live.current === current) finish().then((voice) => voice && onLimitRef.current?.(voice));
    }, 200);
  }, [cleanup, finish]);

  useEffect(() => cleanup, [cleanup]);

  return { state, elapsed, level, error, clearError: () => setError(""), start, stop: finish, cancel: cleanup };
}
