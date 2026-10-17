"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * The short silent film at the top of the about page (public/video/hero.mp4 and hero.webm, made from the photos in
 * public/brand/photos). It shows no app screens on purpose: visitors were confused when a video
 * looked different from the real app. Plays on a loop; stays still for visitors who asked for less
 * motion, and stops while off screen.
 *
 * The about page is mounted (hidden) ahead of the app on every phone page, so the video files are only
 * requested once the film is first on screen; until then the page holds just the poster.
 */
export function HeroFilm() {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = video.current;
    if (!node) return undefined;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        node.pause();
        return;
      }
      setSeen(true);
      if (!calm && !node.dataset.userPaused && node.querySelector("source")) node.play().catch(() => {});
    }, { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = video.current;
    if (!seen || !node) return;
    node.load();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!calm && !node.dataset.userPaused) node.play().catch(() => {});
  }, [seen]);

  function toggle() {
    const node = video.current;
    if (!node) return;
    if (node.paused) {
      delete node.dataset.userPaused;
      node.play().catch(() => {});
    } else {
      node.dataset.userPaused = "1";
      node.pause();
    }
  }

  return (
    <div className="appLanding__film">
      <video
        ref={video}
        poster="/video/hero-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="فیلم کوتاه معرفی فرفرو، بی‌صدا"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        {seen ? <source src="/video/hero.mp4" type="video/mp4" /> : null}
        {seen ? <source src="/video/hero.webm" type="video/webm" /> : null}
      </video>
      <button type="button" className="appLanding__filmToggle" onClick={toggle} aria-label={playing ? "توقف فیلم" : "پخش فیلم"}>
        {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
