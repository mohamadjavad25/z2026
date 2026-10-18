"use client";

import { useEffect, useRef, useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { CLIENT_CATEGORIES } from "../../shared/constants/clientCategories";

// Set once the client has scrolled the row themselves; until then the row gives a small nudge.
const SCROLLED_KEY = "frfro-cats-scrolled";

function hasScrolledBefore() {
  try {
    return window.localStorage.getItem(SCROLLED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberScrolled() {
  try {
    window.localStorage.setItem(SCROLLED_KEY, "1");
  } catch {
    // Private window or blocked storage: the nudge just shows again next time.
  }
}

/** «چه کاری می‌خواهی؟»: what a client usually comes for, one tap each. */
export function CategoryGrid({ busyId = "", onPick }) {
  const rowRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [hinting, setHinting] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    // RTL: scrollLeft runs from 0 towards negative, so compare its size.
    const update = () => {
      setAtStart(Math.abs(row.scrollLeft) < 4);
      setAtEnd(Math.abs(row.scrollLeft) + row.clientWidth >= row.scrollWidth - 4);
    };
    let scrolled = false;
    const onScroll = () => {
      update();
      if (!scrolled && Math.abs(row.scrollLeft) > 8) {
        scrolled = true;
        setHinting(false);
        rememberScrolled();
      }
    };
    update();
    row.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);

    // One soft nudge, once the row is on screen, for clients who never scrolled it.
    let timer = 0;
    let observer = null;
    const overflows = row.scrollWidth > row.clientWidth + 4;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (overflows && !calm && !hasScrolledBefore() && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting) return;
          observer.disconnect();
          timer = window.setTimeout(() => setHinting(true), 700);
        },
        { threshold: 0.6 }
      );
      observer.observe(row);
    }

    return () => {
      row.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={rowRef}
      className={`cnCats${atStart ? "" : " is-moved"}${atEnd ? " is-end" : ""}${hinting ? " is-hinting" : ""}`}
      role="group"
      aria-label="چه کاری می‌خواهی؟"
      onAnimationEnd={() => setHinting(false)}
    >
      {CLIENT_CATEGORIES.map((category) => (
        <button
          type="button"
          key={category.id}
          className={`cnCat${busyId === category.id ? " is-busy" : ""}`}
          disabled={Boolean(busyId)}
          onClick={() => onPick?.(category)}
        >
          <ServiceIcon emoji={category.icon} name={category.label} size="md" />
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  );
}
