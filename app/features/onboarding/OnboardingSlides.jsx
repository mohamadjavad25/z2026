"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toPersianDigits } from "../../shared/lib/digits";
import { trackAction } from "../../shared/lib/activity";
import { TRIO, TUTORIAL_SLIDES, picturesOf, tutorialPicture } from "./slides";

const SCREEN_RATIO = 1266 / 585;
const BEZEL = 7;

/**
 * Full-screen slides: the welcome or one role's tutorial (slides.js). Each slide waits for its own picture before
 * the camera starts, so a tap is never drawn over the previous slide's screen (owner's report of 2026-11-01).
 * `onDone` runs on the last slide's button and on «رد شدن».
 */
export function OnboardingSlides({ flow, onDone }) {
  const data = TUTORIAL_SLIDES[flow];
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const sceneRef = useRef(null);
  const rigRef = useRef(null);
  const phoneRef = useRef(null);
  const handRef = useRef(null);
  const spotRef = useRef(null);
  const startX = useRef(null);
  const slides = data?.slides || [];
  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const still = Boolean(slide?.trio) || slide?.z === 1;

  // Every picture of this flow starts loading now.
  useEffect(() => {
    picturesOf(flow).forEach((name) => {
      const image = new Image();
      image.src = tutorialPicture(name);
    });
  }, [flow]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  const layout = useCallback(() => {
    const scene = sceneRef.current;
    const phone = phoneRef.current;
    const rig = rigRef.current;
    if (!scene || !phone || !rig || !slide) return;
    const sw = scene.clientWidth;
    const sh = scene.clientHeight;
    // The phone at rest: as tall as the scene allows, centred, a little room at the top for the counter.
    const ph = Math.max(200, Math.min(sh - 70, (sw - 80) * SCREEN_RATIO));
    const pw = (ph - 2 * BEZEL) / SCREEN_RATIO + 2 * BEZEL;
    const left = (sw - pw) / 2;
    const top = 44 + (sh - 44 - ph) / 2;
    Object.assign(phone.style, { width: `${pw}px`, height: `${ph}px`, left: `${left}px`, top: `${top}px` });
    Object.assign(rig.style, { width: `${sw}px`, height: `${sh}px` });
    if (still) return;
    const screenW = pw - 2 * BEZEL;
    const screenH = ph - 2 * BEZEL;
    // The spot in scene coordinates, then the camera move that brings it to the middle of the scene.
    const tx = left + BEZEL + (slide.x / 100) * screenW;
    const ty = top + BEZEL + (slide.y / 100) * screenH;
    rig.style.setProperty("--cs", String(slide.z));
    rig.style.setProperty("--cx", `${sw / 2 - tx * slide.z}px`);
    rig.style.setProperty("--cy", `${sh * 0.52 - ty * slide.z}px`);
    spotRef.current?.style.setProperty("--sx", `${slide.x}%`);
    spotRef.current?.style.setProperty("--sy", `${slide.y}%`);
    spotRef.current?.style.setProperty("--sr", `${(slide.r / 100) * screenW}px`);
    if (handRef.current) {
      Object.assign(handRef.current.style, { left: `${tx}px`, top: `${ty}px` });
      handRef.current.style.setProperty("--hs", (1 / slide.z).toFixed(3));
    }
  }, [slide, still]);

  useLayoutEffect(() => {
    if (!ready) return undefined;
    layout();
    // The camera starts a frame after the phone is placed: started in the same frame, the browser can take the
    // move's end point from before it was measured and never zoom.
    const frame = requestAnimationFrame(() => setRunning(true));
    return () => cancelAnimationFrame(frame);
  }, [ready, layout]);

  useEffect(() => {
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, [layout]);

  const go = useCallback((next) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    if (clamped === index) return;
    setReady(false);
    setRunning(false);
    setIndex(clamped);
  }, [index, slides.length]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowLeft") go(index + 1);
      if (event.key === "ArrowRight") go(index - 1);
      if (event.key === "Escape") onDone?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, onDone]);

  if (!data || !slide || typeof document === "undefined") return null;

  const next = () => {
    if (!isLast) return go(index + 1);
    if (flow !== "welcome") trackAction("tutorial_done");
    return onDone?.();
  };
  const skip = () => {
    if (flow !== "welcome") trackAction(`tutorial_skip:${index + 1}`);
    onDone?.();
  };

  return createPortal(
    <div className="onbRoot" role="dialog" aria-modal="true" aria-label={flow === "welcome" ? "خوش‌آمد فرفرو" : "آموزش فرفرو"}>
      <section className="onbSlide">
        <div
          className={`onbScene ${running ? (still ? "is-still" : "is-go") : ""}`}
          ref={sceneRef}
          onTouchStart={(event) => { startX.current = event.touches[0].clientX; }}
          onTouchEnd={(event) => {
            if (startX.current === null) return;
            const dx = event.changedTouches[0].clientX - startX.current;
            startX.current = null;
            if (Math.abs(dx) > 40) go(index + (dx > 0 ? 1 : -1));
          }}
        >
          <span className="onbCount">{toPersianDigits(index + 1)} از {toPersianDigits(slides.length)}</span>
          {isLast ? null : <button type="button" className="onbSkip" onClick={skip}>رد شدن</button>}

          {slide.trio ? (
            <div className="onbTrio">
              {TRIO.map((item) => (
                <figure className={`onbMini is-${item.side}`} key={item.img}>
                  <div className="onbPhone">
                    <div className="onbScreen">
                      <img src={tutorialPicture(item.img)} alt="" onLoad={item.side === "mid" ? () => setReady(true) : undefined} />
                    </div>
                  </div>
                  <figcaption>{item.label}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            // A new rig per slide: the camera's move always starts from the beginning (a reused element keeps running
            // the previous slide's timeline when the class comes back in the same frame).
            <div className="onbRig" ref={rigRef} key={`${flow}-${index}`}>
              <div className="onbPhone" ref={phoneRef}>
                <div className="onbScreen">
                  <img
                    src={tutorialPicture(slide.img)}
                    alt={`صفحهٔ برنامه: ${slide.t}`}
                    onLoad={() => setReady(true)}
                    style={{ visibility: ready ? "visible" : "hidden" }}
                  />
                  {still ? null : <span className="onbSpot" ref={spotRef} />}
                </div>
              </div>
              {still || slide.hand === false ? null : (
                <span className="onbHand" ref={handRef} aria-hidden="true">
                  <span className="onbRipple" />
                  <svg viewBox="0 0 48 48"><path d="M19 6.5c2 0 3.5 1.6 3.5 3.6v12.2l1.6-.4c1.7-.4 3.4.6 3.9 2.3l.1.4 1.9-.4c1.7-.3 3.3.7 3.8 2.3l2-.3c1.9-.3 3.6 1.1 3.7 3l.2 4.4c.2 5.8-4.2 10.7-10 11h-4.2c-3.5 0-6.8-1.7-8.8-4.6l-6.7-9.6c-1.1-1.6-.7-3.8.9-4.9 1.4-1 3.4-.8 4.6.5l1.9 2V10.1c0-2 1.6-3.6 3.6-3.6Z" /></svg>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="onbCopy" aria-live="polite">
          <h2>{slide.t}</h2>
          <p>{slide.p}</p>
          <div className="onbDots" aria-hidden="true">
            {slides.map((_, i) => <i key={i} className={i === index ? "is-on" : ""} />)}
          </div>
          <div className="onbNav">
            <button type="button" className="onbPrev" onClick={() => go(index - 1)} disabled={index === 0}>قبلی</button>
            <button type="button" className="onbNext" onClick={next}>{isLast ? data.last : "بعدی"}</button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
