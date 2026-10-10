"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageUp, X } from "lucide-react";

const SCAN_INTERVAL_MS = 160;
const MAX_FRAME_SIDE = 720;

let jsQrPromise = null;
function loadJsQr() {
  if (!jsQrPromise) jsQrPromise = import("jsqr").then((module) => module.default || module);
  return jsQrPromise;
}

async function createNativeDetector() {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) return null;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats?.();
    if (Array.isArray(formats) && !formats.includes("qr_code")) return null;
    return new window.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

/** Draws `source` scaled down into `canvas` and returns its pixels. */
function grabFrame(canvas, source, width, height) {
  const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

async function decodeWithJsQr(canvas, source, width, height) {
  const jsQR = await loadJsQr();
  const frame = grabFrame(canvas, source, width, height);
  return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" })?.data || "";
}

/**
 * Full-screen QR scanner: back camera with a framing box, plus "choose a photo"
 * for when the camera is blocked or unavailable.
 *
 * Uses the browser's BarcodeDetector where it exists and falls back to jsQR
 * (loaded only when needed). Scanning stops while `paused` is true, so the
 * parent can show what was found in `footer` and resume with "scan again".
 *
 * Props:
 *  - title, hint: texts on the screen
 *  - onDetected(text): called once per code found
 *  - paused: stop decoding (camera stays on)
 *  - footer: node shown at the bottom (result card, errors)
 *  - onClose
 */
export function QrScanner({ title = "اسکن کن", hint = "کد QR را داخل کادر بگیر", onDetected, paused = false, footer = null, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(paused);
  const onDetectedRef = useRef(onDetected);
  const [cameraState, setCameraState] = useState("starting"); // starting | live | blocked | unsupported
  const [photoError, setPhotoError] = useState("");

  pausedRef.current = paused;
  onDetectedRef.current = onDetected;

  const report = useCallback((text) => {
    if (!text || pausedRef.current) return;
    pausedRef.current = true;
    onDetectedRef.current?.(text);
  }, []);

  // Camera + decode loop. Everything is torn down on close.
  useEffect(() => {
    let stream = null;
    let timer = 0;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setCameraState("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        if (!stopped) setCameraState("blocked");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setCameraState("live");

      const detector = await createNativeDetector();
      const tick = async () => {
        if (stopped) return;
        if (!pausedRef.current && video.readyState >= 2 && video.videoWidth) {
          try {
            const text = detector
              ? (await detector.detect(video))[0]?.rawValue || ""
              : await decodeWithJsQr(canvasRef.current, video, video.videoWidth, video.videoHeight);
            report(text);
          } catch {
            // a dropped frame; try the next one
          }
        }
        timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    }

    start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [report]);

  // Escape closes, like every other sheet.
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function scanPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const bitmap = await createImageBitmap(file);
      const text = await decodeWithJsQr(canvasRef.current, bitmap, bitmap.width, bitmap.height);
      bitmap.close?.();
      if (text) {
        pausedRef.current = false;
        report(text);
      } else {
        setPhotoError("در این عکس کد QR پیدا نشد.");
      }
    } catch {
      setPhotoError("این عکس باز نشد.");
    }
  }

  if (typeof document === "undefined") return null;

  const cameraMessage = cameraState === "blocked"
    ? "دسترسی دوربین داده نشد. از تنظیمات مرورگر اجازه بده، یا عکس کد را انتخاب کن."
    : cameraState === "unsupported"
      ? "این مرورگر به دوربین دسترسی ندارد؛ عکس کد را انتخاب کن."
      : "";

  return createPortal(
    <div className="qrScanner" role="dialog" aria-modal="true" aria-label={title}>
      <video ref={videoRef} className="qrScannerVideo" playsInline muted aria-hidden="true" />
      <canvas ref={canvasRef} hidden />
      <div className="qrScannerTop">
        <b>{title}</b>
        <button type="button" className="qrScannerClose" onClick={onClose} aria-label="بستن">
          <X size={20} />
        </button>
      </div>
      <div className={`qrScannerFrame ${cameraState === "live" ? "" : "is-idle"}`} aria-hidden="true">
        <span className="is-tl" /><span className="is-tr" /><span className="is-bl" /><span className="is-br" />
      </div>
      <p className="qrScannerHint" role="status">{cameraMessage || photoError || hint}</p>
      <div className="qrScannerBottom">
        {footer || (
          <label className="qrScannerPhoto">
            <ImageUp size={18} aria-hidden="true" />
            انتخاب عکس کد
            <input type="file" accept="image/*" onChange={scanPhoto} />
          </label>
        )}
      </div>
    </div>,
    document.body
  );
}
