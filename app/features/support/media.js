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

/** The first recording format this browser can make: Opus in WebM on Chrome/Android/Firefox, AAC in MP4 on Safari. */
function recordingType() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", "audio/aac"].find((type) => MediaRecorder.isTypeSupported?.(type)) ?? "";
}

export const canRecordVoice = () =>
  typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && recordingType() !== null;

/**
 * Voice recording: start() asks for the microphone and records; stop() resolves with { data, durationMs, blob } (data is a data URL),
 * cancel() throws the recording away. `level` (0..1) is the live loudness, for the little bars while recording.
 * Stops on its own at three minutes and hands the recording to `onLimit`.
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
    cancelAnimationFrame(current.frame);
    if (current.recorder.state !== "inactive") {
      current.recorder.onstop = null;
      current.recorder.stop();
    }
    current.stream.getTracks().forEach((track) => track.stop());
    current.audio?.close?.().catch(() => {});
    setState("idle");
    setElapsed(0);
    setLevel(0);
  }, []);

  const finish = useCallback(() => {
    const current = live.current;
    if (!current || current.stopping) return Promise.resolve(null);
    current.stopping = true;
    return new Promise((resolve) => {
      const durationMs = Date.now() - current.startedAt;
      current.recorder.onstop = async () => {
        const blob = new Blob(current.chunks, { type: current.recorder.mimeType || current.type || "audio/webm" });
        cleanup();
        if (durationMs < 700 || blob.size < 200) {
          setError("صدا خیلی کوتاه بود. دکمهٔ میکروفون را بزن و حرف بزن.");
          return resolve(null);
        }
        resolve({ data: await readAsDataUrl(blob), durationMs, blob });
      };
      if (current.recorder.state !== "inactive") current.recorder.stop();
      else current.recorder.onstop();
      clearInterval(current.timer);
    });
  }, [cleanup]);

  const start = useCallback(async () => {
    if (live.current) return;
    setError("");
    setState("starting");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (failure) {
      setState("idle");
      setError(failure?.name === "NotAllowedError" ? "اجازهٔ میکروفون داده نشد. از تنظیمات مرورگر یا گوشی اجازه بده." : "میکروفون پیدا نشد.");
      return;
    }
    const type = recordingType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 48000 });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    const current = { stream, recorder, type, chunks: [], startedAt: Date.now(), timer: 0, frame: 0, audio: null };
    recorder.ondataavailable = (event) => event.data?.size && current.chunks.push(event.data);
    live.current = current;
    recorder.start(250);
    setState("recording");
    current.timer = setInterval(() => {
      const ms = Date.now() - current.startedAt;
      setElapsed(ms);
      if (ms >= MAX_VOICE_SECONDS * 1000 && live.current === current) finish().then((voice) => voice && onLimitRef.current?.(voice));
    }, 200);
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audio = new AudioCtx();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 256;
      audio.createMediaStreamSource(stream).connect(analyser);
      current.audio = audio;
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
        setLevel(Math.min(1, peak / 64));
        current.frame = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // The level bars are decoration; recording works without them.
    }
  }, [finish]);

  useEffect(() => cleanup, [cleanup]);

  return { state, elapsed, level, error, clearError: () => setError(""), start, stop: finish, cancel: cleanup };
}
