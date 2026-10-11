"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageUp, RefreshCw, X } from "lucide-react";

const SCAN_INTERVAL_MS = 120;
const CAMERA_FRAME_SIDE = 720; // whole camera frame, scaled down
const CAMERA_CROP_SIDE = 640; // the framing box only, at (nearly) full detail
const PHOTO_SIDES = [900, 1500, 2400]; // a chosen photo: small codes need the bigger passes

let jsQrPromise = null;
function loadJsQr() {
  if (!jsQrPromise) jsQrPromise = import("jsqr").then((module) => module.default || module);
  return jsQrPromise;
}

/**
 * Back camera when there is one, any camera otherwise (laptops, some tablets).
 * Asks for HD: the browser default (often 640×480) leaves a code held at arm's
 * length too few pixels to read.
 */
async function openCamera() {
  const wanted = { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: wanted, audio: false });
  } catch (error) {
    if (error?.name !== "OverconstrainedError" && error?.name !== "NotFoundError" && error?.name !== "NotReadableError") throw error;
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  // Keep refocusing as the phone moves (ignored where unsupported).
  const [track] = stream.getVideoTracks();
  track?.applyConstraints?.({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
  return stream;
}

/**
 * The browser's own QR reader, or null. Treated only as a fast path: on many
 * Android phones it exists but never finds anything (its Google Play module is
 * missing or not downloaded), so jsQR always runs as well — see the scan loop.
 */
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

async function detectNative(detector, source) {
  if (!detector) return "";
  const codes = await detector.detect(source);
  return codes.find((code) => code?.rawValue)?.rawValue || "";
}

/** Draws the `crop` of `source` into `canvas`, at most `maxSide` px on its long edge, and returns its pixels. */
function grabFrame(canvas, source, crop, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function readJsQr(jsQR, canvas, source, crop, maxSide, inversionAttempts) {
  const frame = grabFrame(canvas, source, crop, maxSide);
  return jsQR(frame.data, frame.width, frame.height, { inversionAttempts })?.data || "";
}

/** The centred square the framing box shows (a bit larger, so a code slightly off-centre still fits). */
function centreCrop(width, height, share = 0.85) {
  const side = Math.round(Math.min(width, height) * share);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), width: side, height: side };
}

/**
 * One camera frame with jsQR. Alternates two views so neither costs every
 * frame: the framing box at full detail (small or distant codes) and the whole
 * frame scaled down (a code held off to the side).
 */
function decodeCameraFrame(jsQR, canvas, video, pass) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  return pass % 2 === 0
    ? readJsQr(jsQR, canvas, video, centreCrop(width, height), CAMERA_CROP_SIDE, "dontInvert")
    : readJsQr(jsQR, canvas, video, { x: 0, y: 0, width, height }, CAMERA_FRAME_SIDE, "attemptBoth");
}

/** A chosen photo: the browser's reader if it works, then jsQR at growing sizes, whole and centre. */
async function decodePhoto(canvas, bitmap, detector) {
  try {
    const text = await detectNative(detector, bitmap);
    if (text) return text;
  } catch {
    // fall through to jsQR
  }
  const jsQR = await loadJsQr();
  const whole = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const centre = centreCrop(bitmap.width, bitmap.height, 0.6);
  const longSide = Math.max(bitmap.width, bitmap.height);
  for (const side of PHOTO_SIDES) {
    const text = readJsQr(jsQR, canvas, bitmap, whole, side, "attemptBoth")
      || readJsQr(jsQR, canvas, bitmap, centre, side * 0.6, "attemptBoth");
    if (text) return text;
    if (side >= longSide) break; // already at full size; bigger passes would be the same
  }
  return "";
}

/** A short buzz so the person knows the code was read (phones only; ignored elsewhere). */
function buzz() {
  try {
    navigator.vibrate?.(40);
  } catch {
    // not allowed here
  }
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
  const [cameraState, setCameraState] = useState("starting"); // starting | live | blocked | missing | unsupported
  const [attempt, setAttempt] = useState(0); // bumped by "try again" to reopen the camera
  const [photoError, setPhotoError] = useState("");
  const [readingPhoto, setReadingPhoto] = useState(false);

  pausedRef.current = paused;
  onDetectedRef.current = onDetected;

  const report = useCallback((text) => {
    const value = String(text || "").trim();
    if (!value || pausedRef.current) return;
    pausedRef.current = true;
    buzz();
    onDetectedRef.current?.(value);
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
      loadJsQr().catch(() => {}); // fetch the decoder while the permission prompt is up
      try {
        stream = await openCamera();
      } catch (error) {
        if (!stopped) setCameraState(error?.name === "NotFoundError" || error?.name === "OverconstrainedError" ? "missing" : "blocked");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      if (stopped) return;
      setCameraState("live");

      // The browser's reader (where it works) and jsQR both run: the native one
      // alone left phones whose reader never answers with a camera that reads nothing.
      let detector = await createNativeDetector();
      const jsQR = await loadJsQr().catch(() => null);
      let pass = 0;
      const tick = async () => {
        if (stopped) return;
        if (!pausedRef.current && video.readyState >= 2 && video.videoWidth) {
          let text = "";
          if (detector) {
            try {
              text = await detectNative(detector, video);
            } catch (error) {
              // A reader that throws once ("not supported", missing module) keeps throwing.
              if (error?.name !== "InvalidStateError") detector = null;
            }
          }
          if (!text && jsQR && !stopped && !pausedRef.current) {
            try {
              text = decodeCameraFrame(jsQR, canvasRef.current, video, pass);
            } catch {
              // a dropped frame; try the next one
            }
            pass += 1;
          }
          if (!stopped) report(text);
        }
        if (!stopped) timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    }

    setCameraState("starting");
    start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [report, attempt]);

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
    setReadingPhoto(true);
    try {
      const bitmap = await createImageBitmap(file);
      const text = await decodePhoto(canvasRef.current, bitmap, await createNativeDetector());
      bitmap.close?.();
      if (text) {
        pausedRef.current = false;
        report(text);
      } else {
        setPhotoError("در این عکس کد QR پیدا نشد.");
      }
    } catch {
      setPhotoError("این عکس باز نشد.");
    } finally {
      setReadingPhoto(false);
    }
  }

  if (typeof document === "undefined") return null;

  const cameraMessage = {
    blocked: "دسترسی دوربین داده نشد. از تنظیمات مرورگر برای این سایت اجازهٔ دوربین بده و «دوباره» را بزن، یا عکس کد را انتخاب کن.",
    missing: "دوربینی پیدا نشد؛ عکس کد را انتخاب کن.",
    unsupported: "این مرورگر به دوربین دسترسی ندارد؛ عکس کد را انتخاب کن."
  }[cameraState] || "";

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
      <p className="qrScannerHint" role="status">{readingPhoto ? "در حال خواندن عکس…" : photoError || cameraMessage || (cameraState === "starting" ? "در حال باز کردن دوربین…" : hint)}</p>
      <div className="qrScannerBottom">
        {footer || (
          <div className="qrScannerActions">
            {cameraState === "blocked" ? (
              <button type="button" className="qrScannerPhoto" onClick={() => setAttempt((value) => value + 1)}>
                <RefreshCw size={18} aria-hidden="true" />
                دوباره
              </button>
            ) : null}
            <label className="qrScannerPhoto">
              <ImageUp size={18} aria-hidden="true" />
              انتخاب عکس کد
              <input type="file" accept="image/*" onChange={scanPhoto} />
            </label>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
