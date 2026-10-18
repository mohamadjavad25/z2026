"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, X } from "lucide-react";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { attachmentUrl, duration } from "./media";

/**
 * A voice note: one round play button, a bar that fills as it plays (tap it to jump), and the length.
 * The length comes from the recorder (WebM files from Chrome often do not know their own length).
 */
export function VoicePlayer({ src, durationMs }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState(false);
  const total = (Number.isFinite(ref.current?.duration) && ref.current.duration > 0 ? ref.current.duration * 1000 : 0) || Number(durationMs) || 0;
  const progress = total ? Math.min(1, position / total) : 0;

  function toggle() {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) {
      // Only one voice note plays at a time.
      document.querySelectorAll("audio[data-support-voice]").forEach((other) => other !== audio && other.pause());
      audio.play().catch(() => setFailed(true));
    } else audio.pause();
  }

  function seek(event) {
    const audio = ref.current;
    if (!audio || !total) return;
    const box = event.currentTarget.getBoundingClientRect();
    // The bar fills from the right in RTL.
    const ratio = Math.min(1, Math.max(0, (box.right - event.clientX) / box.width));
    audio.currentTime = (ratio * total) / 1000;
    setPosition(ratio * total);
  }

  return (
    <div className={`scVoice${playing ? " is-playing" : ""}`}>
      <button type="button" className="scVoicePlay" onClick={toggle} aria-label={playing ? "توقف پیام صوتی" : "پخش پیام صوتی"}>
        {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
      </button>
      <span className="scVoiceTrack" onClick={seek} role="presentation">
        <i style={{ inlineSize: `${progress * 100}%` }} />
      </span>
      <small className="scVoiceTime">{failed ? "پخش نشد" : duration(playing || position ? position : total)}</small>
      <audio
        ref={ref}
        data-support-voice=""
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime * 1000)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** A picture opened over everything, closed by the back button, Escape, a tap outside or the X. */
function Lightbox({ src, onClose }) {
  useBackHandler(true, onClose);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return createPortal(
    <div className="scLightbox" role="dialog" aria-modal="true" aria-label="نمایش عکس" onClick={onClose}>
      <button type="button" className="scLightboxClose" onClick={onClose} aria-label="بستن عکس"><X size={22} aria-hidden="true" /></button>
      <img src={src} alt="" onClick={(event) => event.stopPropagation()} />
    </div>,
    document.body
  );
}

/** The pictures and voice note of one message. `items` are { id, kind, duration_ms } from the API, or { src, kind } while sending. */
export function MessageAttachments({ items }) {
  const [open, setOpen] = useState(null);
  if (!items?.length) return null;
  const images = items.filter((item) => item.kind === "image");
  const voice = items.find((item) => item.kind === "voice");
  const srcOf = (item) => item.src || attachmentUrl(item.id);
  return (
    <>
      {images.length ? (
        <div className={`scImages is-${Math.min(images.length, 4)}`}>
          {images.map((item, index) => (
            <button key={item.id ?? index} type="button" onClick={() => setOpen(srcOf(item))} aria-label="بزرگ‌کردن عکس" disabled={!item.id}>
              <img src={srcOf(item)} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : null}
      {voice ? <VoicePlayer src={srcOf(voice)} durationMs={voice.duration_ms ?? voice.durationMs} /> : null}
      {open ? <Lightbox src={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
