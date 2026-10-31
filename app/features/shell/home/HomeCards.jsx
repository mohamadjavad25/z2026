"use client";

import { useEffect, useRef, useState } from "react";

const AUTO_MS = 5000;

/**
 * The owner's small cards on the home, in one slider of one fixed size (owner's idea 2026-10-31, so more cards never
 * pile up). Each child that renders a <section> is one slide; a child that renders nothing leaves no gap. With more
 * than one slide they move by themselves every five seconds, stop while a finger or the keyboard is on them or the
 * page is hidden, never move for people who asked for less motion, and can always be swiped or picked by a dot.
 */
export function HomeCards({ children }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const [count, setCount] = useState(0);
  const [index, setIndex] = useState(0);

  // How many slides there are right now (cards come and go as their news changes).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const update = () => setCount(track.querySelectorAll(":scope > section").length);
    update();
    const observer = new MutationObserver(update);
    observer.observe(track, { childList: true });
    return () => observer.disconnect();
  }, []);

  function slides() {
    return trackRef.current ? [...trackRef.current.querySelectorAll(":scope > section")] : [];
  }

  function goTo(i) {
    const list = slides();
    const target = list[(i + list.length) % list.length];
    const track = trackRef.current;
    if (!target || !track) return;
    // Scrolls the slider only; scrollIntoView could also move the page.
    const delta = target.getBoundingClientRect().left - track.getBoundingClientRect().left;
    track.scrollBy({ left: delta, behavior: "smooth" });
    setIndex((i + list.length) % list.length);
  }

  function onScroll() {
    const track = trackRef.current;
    const list = slides();
    if (!track || !list.length) return;
    const middle = track.getBoundingClientRect().left + track.clientWidth / 2;
    let best = 0;
    let gap = Infinity;
    list.forEach((slide, i) => {
      const rect = slide.getBoundingClientRect();
      const d = Math.abs(rect.left + rect.width / 2 - middle);
      if (d < gap) { gap = d; best = i; }
    });
    setIndex(best);
  }

  useEffect(() => {
    if (count < 2) return undefined;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      goTo(index + 1);
    }, AUTO_MS);
    return () => window.clearInterval(timer);
    // goTo reads the live DOM; only the slide number and count matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, index]);

  const hold = (on) => () => { pausedRef.current = on; };

  return (
    <div className={`homeCards${count > 1 ? " has-many" : ""}`} onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerCancel={hold(false)} onFocus={hold(true)} onBlur={hold(false)} onMouseEnter={hold(true)} onMouseLeave={hold(false)}>
      <div className="homeCardsTrack" ref={trackRef} onScroll={onScroll}>
        {children}
      </div>
      {count > 1 ? (
        <div className="homeCardsDots" role="tablist" aria-label="کارت‌ها">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === index} aria-label={`کارت ${i + 1}`} className={i === index ? "is-on" : ""} onClick={() => goTo(i)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
